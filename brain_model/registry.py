"""The published layers, one entry each, which the build and the validation both read.

`LAYERS` is in the manifest's order: the order of its keys, of the limitations the layers add
and of the build's calls to them. Validation reports them in its own order (validate.main).
"""

from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

from .labels import boundary_certainty, nextbrain, segmentation_agreement, white_matter
from .layers import (
    arousal_nuclei,
    arterial_territories,
    cab_np,
    cerebellar_functions,
    coordinate_spaces,
    cortical_layers,
    cortical_thickness,
    disorder_effects,
    functional_connectivity,
    functional_regions,
    landing,
    network_matrix,
    networks,
    neuropsych_domains,
    neurosynth_terms,
    receptor_fingerprints,
    retinotopy,
    stimulation_ftract,
    stimulation_responses,
    striatal_networks,
    stroke_cases,
)
from .sources import HEMISPHERES


@dataclass
class Run:
    """What a layer is exported from."""

    config: dict
    regions: list
    # Set once the tissue labels are exported.
    tissues: dict | None = None
    # What earlier build steps prepared for a layer, by its key.
    prepared: dict = field(default_factory=dict)


@dataclass(frozen=True)
class Check:
    """What a layer is validated against."""

    config: dict
    manifest: dict
    tissues: dict
    nextbrain_source: tuple | None


def no_limitations(config):
    return []


@dataclass(frozen=True)
class Layer:
    """One published layer.

    key: its manifest key, its validation report's key unless `report` says otherwise, and for a
        layer an anatomy declares, its name in that anatomy's `layers`.
    export(run): its manifest value, after writing its files; None: it has no manifest value.
    published(config): whether this anatomy publishes it; None: every anatomy does.
    keyed: the manifest keeps its key, as null, where it is not published.
    inputs(config): the files a declared layer needs before the build starts.
    limitations(config): what it adds to the manifest's limitations.
    validate(check): its validation report.
    metadata(config): the manifest value validation expects where it can know it without
        rebuilding the layer; None: validation checks only that the key is there.
    after_tissues: exported after the tissue labels, which it counts on or which rewrite the cortical
        parcels' placements it reads; its key follows provenance. Every other export runs first.
    compose(config, regions, grids): adds its cut-only regions and shares them out over the
        others on the territory grids; returns what its export reads from `run.prepared`.
    atlas, cut_atlas(): its cut-only regions' atlas, and the cut atlas it adds.
    shared: why `build --only` refuses it: what else rebuilding it would change.
    """

    key: str
    export: Callable[[Run], Any] | None = None
    published: Callable[[dict], bool] | None = None
    keyed: bool = False
    inputs: Callable[[dict], list] | None = None
    limitations: Callable[[dict], list] = no_limitations
    validate: Callable[[Check], Any] | None = None
    report: str | None = None
    metadata: Callable[[dict], Any] | None = None
    after_tissues: bool = False
    compose: Callable[[dict, list, tuple], Any] | None = None
    atlas: str | None = None
    cut_atlas: Callable[[], dict] | None = None
    shared: str | None = None

    def is_published(self, config):
        return self.published is None or self.published(config)

    @property
    def report_key(self):
        return self.report or self.key


def region_layer(key, module):
    """A layer every anatomy publishes: values on the published regions, in a file of its own."""
    return Layer(
        key,
        export=lambda run: module.export(run.config, run.regions),
        limitations=lambda config: module.limitations(),
        validate=lambda check: module.validate(check.config, check.manifest),
    )


def composer(module, unit_grids):
    """Builds a registered atlas's cut-only regions and shares them out over the others."""

    def compose(config, regions, grids):
        definition = module.read_definition()
        regions.extend(module.build_regions(config, definition))
        module.compose(config, definition, regions, *(grids if unit_grids else grids[:1]))
        return definition

    return compose


def network_limitations(config):
    if not networks.is_declared(config):
        return []
    limitations = [
        "Networks describe group resting-state functional connectivity from 1000 subjects, not a region's measured function in this brain.",
        "Cortical parcel network shares count assigned source vertices; NextBrain cortical region shares count assigned projected cortical voxels. Unassigned samples are excluded. Neither is a surface-area fraction.",
    ]
    if config["anatomy"]["individual"]:
        limitations.append(
            "Networks are a group average projected onto one person's folds through registered spheres; they are not this individual's measured networks."
        )
    else:
        limitations.append(
            "Networks are published in this template's space and are not resampled, but they remain a group average of other brains."
        )
    return limitations


CUT_ONLY = "it adds regions, shares them out over the other regions and labels its own cut"

LAYERS = (
    Layer(
        "networks",
        published=networks.is_declared,
        keyed=True,
        inputs=lambda config: [
            networks.annotation_path(config["source_directory"], prefix)
            for prefix in HEMISPHERES
        ],
        export=lambda run: networks.metadata(),
        metadata=lambda config: networks.metadata(),
        limitations=network_limitations,
        shared="its networks are drawn into the cortex meshes and shared out over the regions",
    ),
    region_layer("cab_np", cab_np),
    region_layer("functional_regions", functional_regions),
    region_layer("neuropsych_domains", neuropsych_domains),
    Layer(
        "neurosynth_terms",
        published=neurosynth_terms.is_declared,
        keyed=True,
        inputs=lambda config: [
            neurosynth_terms.DEFINITION, neurosynth_terms.SCORES, neurosynth_terms.ATLAS_SCORES,
        ],
        export=lambda run: neurosynth_terms.export(run.config, run.regions),
        metadata=lambda config: neurosynth_terms.metadata(),
        limitations=neurosynth_terms.limitations,
        validate=lambda check: neurosynth_terms.validate(check.config, check.manifest),
    ),
    region_layer("receptor_fingerprints", receptor_fingerprints),
    region_layer("stimulation_responses", stimulation_responses),
    Layer(
        "stimulation_ftract",
        # A delay's distance is between the centroids the tissue export gives the cortical parcels.
        after_tissues=True,
        export=lambda run: stimulation_ftract.export(run.config, run.regions),
        limitations=lambda config: stimulation_ftract.limitations(),
        validate=lambda check: stimulation_ftract.validate(check.config, check.manifest),
    ),
    region_layer("functional_connectivity", functional_connectivity),
    Layer(
        "network_matrix",
        published=network_matrix.is_declared,
        inputs=network_matrix.inputs,
        export=lambda run: network_matrix.export(run.config),
        limitations=lambda config: network_matrix.limitations(),
        validate=lambda check: network_matrix.validate(check.config, check.manifest),
    ),
    region_layer("disorder_effects", disorder_effects),
    Layer(
        "white_matter",
        published=white_matter.is_declared,
        inputs=lambda config: [white_matter.path(config)],
        limitations=white_matter.limitations,
        validate=lambda check: white_matter.validate_volume(
            check.config, check.tissues["white_matter"]
        ),
        shared="its regions and cut labels are built with the anatomy",
    ),
    # Boundary certainty's and segmentation agreement's limitations are NextBrain's, among the
    # anatomy's own (build.base_limitations).
    Layer(
        "boundary_certainty",
        published=boundary_certainty.is_published,
        export=lambda run: boundary_certainty.export(run.config, run.regions),
        metadata=boundary_certainty.metadata,
        validate=lambda check: boundary_certainty.validate(
            check.config, check.manifest, check.nextbrain_source
        ),
    ),
    Layer(
        "segmentation_agreement",
        published=nextbrain.is_declared,
        export=lambda run: segmentation_agreement.export(run.config, run.regions),
        validate=lambda check: segmentation_agreement.validate(
            check.config, check.manifest, check.nextbrain_source
        ),
        report="segmentation_agreement_map",
    ),
    Layer(
        "arterial_territories",
        published=arterial_territories.is_declared,
        inputs=lambda config: [
            arterial_territories.DEFINITION,
            arterial_territories.volume_path(config),
            arterial_territories.report_path(config),
            *([] if coordinate_spaces.template_space(config) else [landing.path(config)]),
        ],
        compose=composer(arterial_territories, unit_grids=True),
        atlas=arterial_territories.ATLAS_ID,
        cut_atlas=lambda: arterial_territories.cut_atlas(arterial_territories.read_definition()),
        export=lambda run: arterial_territories.metadata(
            run.config, run.prepared["arterial_territories"]
        ),
        metadata=lambda config: arterial_territories.metadata(
            config, arterial_territories.read_definition()
        ),
        limitations=lambda config: arterial_territories.limitations(),
        validate=lambda check: arterial_territories.validate(check.config, check.manifest),
        shared=CUT_ONLY,
    ),
    Layer(
        "cerebellar_functions",
        published=cerebellar_functions.is_declared,
        inputs=lambda config: [
            cerebellar_functions.DEFINITION,
            cerebellar_functions.volume_path(config),
            cerebellar_functions.lobules_path(config),
            cerebellar_functions.report_path(config),
        ],
        compose=composer(cerebellar_functions, unit_grids=False),
        atlas=cerebellar_functions.ATLAS_ID,
        cut_atlas=lambda: cerebellar_functions.cut_atlas(cerebellar_functions.read_definition()),
        export=lambda run: cerebellar_functions.metadata(
            run.config, run.prepared["cerebellar_functions"]
        ),
        metadata=lambda config: cerebellar_functions.metadata(
            config, cerebellar_functions.read_definition()
        ),
        limitations=lambda config: cerebellar_functions.limitations(config),
        validate=lambda check: cerebellar_functions.validate(check.config, check.manifest),
        shared=CUT_ONLY,
    ),
    Layer(
        "striatal_networks",
        published=striatal_networks.is_declared,
        inputs=lambda config: [
            striatal_networks.DEFINITION,
            striatal_networks.volume_path(config),
            striatal_networks.carried_path(config),
            striatal_networks.template_aseg_path(config),
            striatal_networks.confidence_path(config),
            striatal_networks.report_path(config),
            *([] if coordinate_spaces.template_space(config) else [landing.path(config)]),
        ],
        compose=composer(striatal_networks, unit_grids=True),
        atlas=striatal_networks.ATLAS_ID,
        cut_atlas=lambda: striatal_networks.cut_atlas(striatal_networks.read_definition()),
        export=lambda run: striatal_networks.metadata(
            run.config, run.prepared["striatal_networks"]
        ),
        metadata=lambda config: striatal_networks.metadata(
            config, striatal_networks.read_definition()
        ),
        limitations=lambda config: striatal_networks.limitations(
            config, striatal_networks.read_definition()
        ),
        validate=lambda check: striatal_networks.validate(check.config, check.manifest),
        shared=CUT_ONLY,
    ),
    Layer(
        "arousal_nuclei",
        published=arousal_nuclei.is_declared,
        inputs=lambda config: [
            arousal_nuclei.DEFINITION,
            arousal_nuclei.volume_path(config),
            arousal_nuclei.carried_path(config),
            arousal_nuclei.report_path(config),
        ],
        limitations=lambda config: arousal_nuclei.limitations(
            config, arousal_nuclei.read_definition()
        ),
        validate=lambda check: arousal_nuclei.validate(check.config, check.manifest),
        shared="its meshes are a supplemental layer built with the anatomy",
    ),
    Layer(
        "coordinate_spaces",
        published=coordinate_spaces.is_declared,
        inputs=lambda config: [
            *coordinate_spaces.inputs(config),
            *([] if coordinate_spaces.template_space(config) else [landing.path(config)]),
        ],
        export=lambda run: coordinate_spaces.export(
            run.config, coordinate_spaces.read_definition()
        ),
        limitations=lambda config: coordinate_spaces.limitations(
            config, coordinate_spaces.read_definition()
        ),
        validate=lambda check: coordinate_spaces.validate(check.config, check.manifest),
    ),
    Layer(
        "landing",
        # A template is not registered onto itself.
        published=lambda config: coordinate_spaces.is_declared(config)
        and not coordinate_spaces.template_space(config),
        export=lambda run: landing.published(landing.read(run.config)),
        metadata=lambda config: landing.published(landing.read(config)),
        validate=lambda check: landing.validate(check.config, check.manifest),
    ),
    Layer(
        "retinotopy",
        published=retinotopy.is_declared,
        inputs=lambda config: retinotopy.inputs(retinotopy.read_definition()),
        # The definition and projected fields the cortex was built with.
        export=lambda run: retinotopy.export(run.config, *run.prepared["retinotopy"]),
        limitations=lambda config: retinotopy.limitations(retinotopy.read_definition()),
        validate=lambda check: retinotopy.validate(check.config, check.manifest),
        shared="its fields are drawn into the cortex meshes",
    ),
    region_layer("cortical_layers", cortical_layers),
    Layer(
        "cortical_thickness",
        published=cortical_thickness.is_declared,
        inputs=cortical_thickness.inputs,
        export=lambda run: cortical_thickness.export(run.config, run.regions),
        limitations=lambda config: cortical_thickness.limitations(),
        validate=lambda check: cortical_thickness.validate(check.config, check.manifest),
    ),
    Layer(
        "stroke_cases",
        published=stroke_cases.is_declared,
        after_tissues=True,
        inputs=lambda config: [
            stroke_cases.DEFINITION,
            stroke_cases.FACTS,
            stroke_cases.lesions_path(config),
            stroke_cases.report_path(config),
        ],
        export=lambda run: stroke_cases.export(run.config, run.tissues),
        metadata=stroke_cases.metadata,
        limitations=lambda config: stroke_cases.limitations(),
        validate=lambda check: stroke_cases.validate(check.config, check.manifest, check.tissues),
    ),
)
