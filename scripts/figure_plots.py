"""Plot panels and the synthetic overlay map for scripts/figures.mjs.

    uv run --no-project --with matplotlib==3.11.2 --with fonttools==4.68.0 --with brotli==1.2.1 \
        --with numpy==2.4.6 --with nibabel==5.4.2 --with scipy==1.18.1 \
        python -I scripts/figure_plots.py --out <directory> --dpi <dpi> <plot>:<width>x<height> ...

figures.mjs runs this itself. Each plot is drawn from the published files under public/ and nothing
else, at the pixel size of its panel, and written as <plot>-light.png and <plot>-dark.png on a
transparent ground. `<name>=<path>` writes the synthetic map of that name instead. Text is Source
Sans 3 at 7 pt, lines are 0.5 pt, and series colours are from Wong (2011).
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MODEL = ROOT / "public" / "models" / "cdmd"
FONT = ROOT / "docs" / "_static" / "fonts" / "source-sans-3-latin-wght-normal.woff2"
INKS = {"light": "#000000", "dark": "#e6edf3"}
# Wong, B. Points of view: Color blindness. Nat. Methods 8, 441 (2011).
BLUE, ORANGE, GREEN, VERMILLION, SKY, PURPLE = (
    "#0072b2",
    "#e69f00",
    "#009e73",
    "#d55e00",
    "#56b4e9",
    "#cc79a7",
)
TEXT_PT = 7
STRUCTURES = ("caudate", "putamen", "thalamus", "hippocampus", "amygdala")


def published(name: str) -> dict:
    return json.loads((MODEL / name).read_text(encoding="utf-8"))


def regular_font(directory: Path) -> Path:
    """Source Sans 3 at weight 400 as a TrueType file: Matplotlib reads neither WOFF2 nor axes."""
    from fontTools.ttLib import TTFont
    from fontTools.varLib import instancer

    font = instancer.instantiateVariableFont(TTFont(FONT), {"wght": 400})
    font.flavor = None
    path = directory / "source-sans-3-regular.ttf"
    font.save(path)
    return path


def axes(figure, ink: str, rectangle):
    """Axes with left and bottom spines and outward ticks, in `ink`."""
    ax = figure.add_axes(rectangle)
    ax.patch.set_alpha(0)
    for side in ("top", "right"):
        ax.spines[side].set_visible(False)
    for side in ("left", "bottom"):
        ax.spines[side].set_color(ink)
        ax.spines[side].set_linewidth(0.5)
    ax.tick_params(colors=ink, width=0.5, length=2.5, labelsize=TEXT_PT, pad=2)
    ax.xaxis.label.set_color(ink)
    ax.yaxis.label.set_color(ink)
    return ax


def fit(figure, margin: float = 0.012) -> None:
    """Move the axes so that everything drawn with them fills the slot, whatever the slot's size.

    The margin is a share of the figure's width, the same on all four sides.
    """
    (ax,) = figure.axes
    edge = margin * figure.bbox.width
    for _ in range(3):
        figure.canvas.draw()
        drawn = ax.get_tightbbox()
        place = ax.get_position()
        left = place.x0 + (edge - drawn.x0) / figure.bbox.width
        bottom = place.y0 + (edge - drawn.y0) / figure.bbox.height
        right = place.x1 + (figure.bbox.width - edge - drawn.x1) / figure.bbox.width
        top = place.y1 + (figure.bbox.height - edge - drawn.y1) / figure.bbox.height
        ax.set_position((left, bottom, right - left, top - bottom))


def segmentation_dice(figure, ink: str) -> None:
    """Dice of NextBrain against aseg per structure, on each of the two grids."""
    validation = published("validation.json")
    fine = validation["segmentation_agreement"]["dice"]
    coarse = validation["segmentation_agreement_map"]["dice_on_aseg_grid"]
    floor = validation["segmentation_agreement"]["minimum_dice"]
    rows = [(name, side) for name in STRUCTURES for side in ("left", "right")]
    ax = axes(figure, ink, (0.3, 0.2, 0.62, 0.74))
    for at, (name, side) in enumerate(rows):
        a, b = fine[name][side], coarse[f"{name} {side}"]
        ax.plot([a, b], [at, at], color=ink, linewidth=0.5, zorder=1)
        ax.plot(a, at, "o", color=BLUE, markersize=3.2, markeredgewidth=0, zorder=2)
        ax.plot(b, at, "s", color=ORANGE, markersize=3, markeredgewidth=0, zorder=2)
    ax.axvline(floor, color=ink, linewidth=0.5, linestyle=(0, (3, 2)))
    ax.text(
        floor + 0.003, -0.75, f"floor {floor}", color=ink, fontsize=TEXT_PT, va="center"
    )
    # The two series are named on the row furthest from the floor, where the names cross nothing.
    at, (name, side) = max(enumerate(rows), key=lambda row: fine[row[1][0]][row[1][1]])
    ax.text(
        fine[name][side] - 0.006,
        at,
        "0.4 mm grid",
        color=ink,
        ha="right",
        va="center",
    )
    ax.text(
        coarse[f"{name} {side}"] + 0.006,
        at,
        "1 mm grid",
        color=ink,
        ha="left",
        va="center",
    )
    ax.set_yticks(
        range(len(rows)), [f"{name.capitalize()}, {side}" for name, side in rows]
    )
    ax.set_ylim(len(rows) - 0.5, -1.2)
    ax.set_xlim(0.75, 0.95)
    ax.set_xticks([0.75, 0.80, 0.85, 0.90, 0.95])
    ax.set_xlabel("Dice of NextBrain and aseg", fontsize=TEXT_PT)
    ax.tick_params(axis="y", length=0)


def boundary_shares(figure, ink: str) -> None:
    """Near-tie share of every rated NextBrain boundary."""
    import numpy as np

    pairs = published("boundary-certainty.json")["pairs"]
    shares = np.array([near / interface for _, _, interface, near in pairs])
    ax = axes(figure, ink, (0.14, 0.2, 0.8, 0.74))
    edges = np.linspace(0, 1, 31)
    soft = shares >= 1 / 3
    ax.hist(shares[~soft], bins=edges, color=BLUE, linewidth=0)
    ax.hist(shares[soft], bins=edges, color=ORANGE, linewidth=0)
    ax.axvline(1 / 3, color=ink, linewidth=0.5, linestyle=(0, (3, 2)))
    top = ax.get_ylim()[1] * 1.22
    ax.set_ylim(0, top)
    ax.text(
        1 / 3 - 0.015,
        top * 0.99,
        f"firm, n = {(~soft).sum():,}",
        color=ink,
        ha="right",
        va="top",
    )
    ax.text(
        1 / 3 + 0.015,
        top * 0.99,
        f"soft, n = {soft.sum():,}",
        color=ink,
        ha="left",
        va="top",
    )
    median = float(np.median(shares))
    ax.annotate(
        f"median {median:.3f}",
        (median, 0),
        (median, top * 0.9),
        color=ink,
        ha="center",
        va="top",
        arrowprops={
            "arrowstyle": "-",
            "color": ink,
            "linewidth": 0.5,
            "shrinkA": 1,
            "shrinkB": 0,
        },
    )
    ax.set_xlim(0, 1)
    ax.set_xlabel("Near-tie share of the boundary's interface voxels", fontsize=TEXT_PT)
    ax.set_ylabel("Boundaries (count)", fontsize=TEXT_PT)


def landing(figure, ink: str) -> None:
    """Median Dice of a structure carried from the template, by the structure's volume."""
    record = published("validation.json")["landing"]
    bins = record["by_volume"]
    lower = [0] + [row["under_mm3"] for row in bins[:-1]]
    names = [
        f"< {row['under_mm3']:,}"
        if at == 0
        else f"{lower[at]:,}–{row['under_mm3']:,}"
        if row["under_mm3"]
        else f"≥ {lower[at]:,}".replace("≥", ">=")
        for at, row in enumerate(bins)
    ]
    names[-1] = f"{lower[-1]:,} and over"
    ax = axes(figure, ink, (0.16, 0.24, 0.78, 0.7))
    values = [row["dice_median"] for row in bins]
    colours = [
        ORANGE if (row["under_mm3"] or 1e9) <= record["under_mm3"] else BLUE
        for row in bins
    ]
    ax.bar(range(len(bins)), values, width=0.62, color=colours, linewidth=0)
    for at, row in enumerate(bins):
        ax.text(
            at,
            values[at] + 0.015,
            f"n = {row['structures']}",
            color=ink,
            ha="center",
            va="bottom",
        )
    ax.set_xticks(range(len(bins)), names)
    ax.set_ylim(0, 0.8)
    ax.set_yticks([0, 0.2, 0.4, 0.6, 0.8])
    ax.set_xlabel("Volume of the structure on this brain (mm³)", fontsize=TEXT_PT)
    ax.set_ylabel("Dice (median)", fontsize=TEXT_PT)
    ax.tick_params(axis="x", length=0)


def template_dice(figure, ink: str) -> None:
    """Dice of structures carried from each MNI template against this brain's own."""
    spaces = published("validation.json")["coordinate_spaces"]
    names = (
        "thalamus",
        "caudate",
        "putamen",
        "pallidum",
        "hippocampus",
        "amygdala",
        "lateral-ventricle",
    )
    rows = [(name, side) for name in names for side in ("left", "right")]
    ax = axes(figure, ink, (0.34, 0.2, 0.58, 0.74))
    series = (("mni152nlin2009casym", BLUE, "o", 3.2), ("spm12", ORANGE, "s", 3))
    for at, (name, side) in enumerate(rows):
        ends = [
            spaces[space]["subcortical_dice"][f"{name}-{side}"] for space, *_ in series
        ]
        ax.plot(ends, [at, at], color=ink, linewidth=0.5, zorder=1)
    for space, colour, marker, size in series:
        dice = spaces[space]["subcortical_dice"]
        ax.plot(
            [dice[f"{name}-{side}"] for name, side in rows]
            + [spaces[space]["cortex_dice"]],
            range(len(rows) + 1),
            marker,
            color=colour,
            markersize=size,
            markeredgewidth=0,
            zorder=2,
        )
    ax.plot(
        [spaces[space]["cortex_dice"] for space, *_ in series],
        [len(rows)] * 2,
        color=ink,
        linewidth=0.5,
        zorder=1,
    )
    first = [spaces[space]["subcortical_dice"]["thalamus-left"] for space, *_ in series]
    ax.text(
        first[0] + 0.006, 0, "MNI152NLin2009cAsym", color=ink, ha="left", va="center"
    )
    ax.text(first[1] - 0.006, 0, "SPM12", color=ink, ha="right", va="center")
    labels = [f"{name.replace('-', ' ').capitalize()}, {side}" for name, side in rows]
    ax.set_yticks(range(len(rows) + 1), [*labels, "Cortex"])
    ax.set_ylim(len(rows) + 0.5, -0.8)
    ax.set_xlim(0.70, 1.0)
    ax.set_xticks([0.70, 0.80, 0.90, 1.00])
    ax.set_xlabel("Dice against this brain's own structure", fontsize=TEXT_PT)
    ax.tick_params(axis="y", length=0)


def rgb(colour) -> tuple[float, float, float]:
    return tuple(channel / 255 for channel in colour)


def division_matrix(figure, ink: str) -> None:
    """How many left-hemisphere HCP-MMP areas each named region takes from each of the 22 sections."""
    from collections import Counter

    record = published("functional-regions.json")
    sections = {level["id"]: level["number"] for level in record["levels"]["sections"]}
    named = [level["id"] for level in record["levels"]["named"]]
    names = [level["short"] for level in record["levels"]["named"]]
    counts = Counter(
        (sections[record["regions"]["sections"][area]], named.index(region))
        for area, region in record["regions"]["named"].items()
        if ":left:" in area
    )
    ax = axes(figure, ink, (0.2, 0.17, 0.78, 0.8))
    for (section, row), count in counts.items():
        ax.scatter(section, row, s=10 + 9 * count, color=BLUE, linewidths=0, zorder=2)
        ax.text(
            section + 0.32,
            row,
            str(count),
            color=ink,
            va="center",
            ha="left",
            fontsize=TEXT_PT - 1,
        )
    ax.set_xticks(range(1, len(sections) + 1))
    ax.set_xlim(0.4, len(sections) + 0.9)
    ax.set_yticks(range(len(names)), names)
    ax.set_ylim(len(names) - 0.4, -0.6)
    ax.set_xlabel("Section of the HCP-MMP parcellation (number)", fontsize=TEXT_PT)
    ax.tick_params(axis="y", length=0)


def stepped_histogram(ax, values, edges, steps, below, ink, rules=None):
    """A histogram whose bars take the colour of the viewer's step they fall in.

    The dashed rules mark the steps. They run the height of the axes, or to `rules` times the tallest bar.
    """
    import numpy as np

    counts, edges = np.histogram(values, bins=edges)
    centres = (edges[:-1] + edges[1:]) / 2
    colours = [
        next(
            (rgb(step["color"]) for step in reversed(steps) if centre >= step["from"]),
            below,
        )
        for centre in centres
    ]
    ax.bar(centres, counts, width=np.diff(edges), color=colours, linewidth=0)
    dashed = {"color": ink, "linewidth": 0.5, "linestyle": (0, (3, 2))}
    for step in steps:
        if step["from"] <= edges[0]:
            continue
        if rules is None:
            ax.axvline(step["from"], **dashed)
        else:
            ax.plot([step["from"]] * 2, [0, counts.max() * rules], **dashed)
    return counts


def layer_iv(figure, ink: str) -> None:
    """Layer IV's share of cortical thickness over the HCP-MMP parcels, in the viewer's four steps."""
    import numpy as np

    record = published("cortical-layers.json")
    shares = {
        area: layers[3] / 1000
        for area, layers in record["regions"].items()
        if area.startswith("hcp-mmp:")
    }
    # Whole bins of half a percent that hold every parcel, primary visual cortex included.
    low = np.floor(min(shares.values()) * 200) / 200
    high = np.ceil(max(shares.values()) * 200) / 200
    ax = axes(figure, ink, (0.13, 0.19, 0.83, 0.74))
    counts = stepped_histogram(
        ax,
        list(shares.values()),
        np.arange(low, high + 0.0001, 0.005),
        record["layer_iv_scale"],
        GREEN,
        ink,
        rules=1.04,
    )
    # The names stand above the dashed rules, so that neither crosses the other.
    top = counts.max() * 1.3
    for at, (name, index) in enumerate((("Area 4", 8), ("Area 3b", 9), ("V1", 1))):
        share = shares[f"hcp-mmp:left:{index}"]
        ax.annotate(
            name,
            (share, 0),
            (share, top * (0.97 - 0.09 * at)),
            color=ink,
            ha="center",
            va="top",
            arrowprops={
                "arrowstyle": "-",
                "color": ink,
                "linewidth": 0.5,
                "shrinkA": 1,
                "shrinkB": 0,
            },
        )
    ax.set_ylim(0, top)
    ax.set_xlim(low, high)
    ticks = [0.05, 0.1, 0.15, 0.2, 0.25]
    ax.set_xticks(ticks, [f"{tick * 100:.0f}" for tick in ticks])
    ax.set_xlabel("Layer IV share of cortical thickness (%)", fontsize=TEXT_PT)
    ax.set_ylabel(f"HCP-MMP parcels (count, n = {len(shares)})", fontsize=TEXT_PT)


def disorder_effects(figure, ink: str) -> None:
    """Every published case-control difference, by disorder, in the viewer's four steps."""
    record = published("disorder-effects.json")
    scale = record["d_scale"]
    ax = axes(figure, ink, (0.27, 0.17, 0.69, 0.8))
    disorders = record["disorders"]
    for row, disorder in enumerate(disorders):
        values = sorted(disorder["effects"].values())
        colours = [
            rgb(
                scale["smaller" if d < 0 else "larger"][
                    1 if abs(d) >= scale["split"] else 0
                ]
            )
            for d in values
        ]
        ax.scatter(
            values, [row] * len(values), s=7, color=colours, linewidths=0, zorder=2
        )
        ax.text(
            1.02,
            row,
            f"n = {len(values)}",
            color=ink,
            va="center",
            ha="left",
            transform=ax.get_yaxis_transform(),
        )
    for split in (-scale["split"], 0, scale["split"]):
        ax.axvline(
            split,
            color=ink,
            linewidth=0.5,
            linestyle="-" if split == 0 else (0, (3, 2)),
            zorder=1,
        )
    ax.set_yticks(
        range(len(disorders)), [disorder["name"]["en"] for disorder in disorders]
    )
    ax.set_ylim(len(disorders) - 0.4, -0.6)
    ax.set_xlabel("Case-control difference (Cohen's d)", fontsize=TEXT_PT)
    ax.tick_params(axis="y", length=0)


def connectivity_r(figure, ink: str) -> None:
    """Group resting-state correlation of every pair of Julich-Brain areas, in the viewer's three steps."""
    import numpy as np

    record = published("functional-connectivity.json")
    r = np.array(record["atlases"]["julich"]["r"]) / 100
    ax = axes(figure, ink, (0.14, 0.19, 0.82, 0.74))
    low = np.floor(r.min() * 20) / 20
    stepped_histogram(
        ax, r, np.arange(low, 1.0001, 0.025), record["r_scale"], "#9aa0a6", ink
    )
    ax.set_xlim(low, 1)
    ax.set_xlabel(
        "Correlation of two areas' resting-state signals (group r)", fontsize=TEXT_PT
    )
    ax.set_ylabel(f"Pairs of areas (count, n = {len(r):,})", fontsize=TEXT_PT)


PLOTS = {
    "segmentation-dice": segmentation_dice,
    "boundary-shares": boundary_shares,
    "landing": landing,
    "template-dice": template_dice,
    "division-matrix": division_matrix,
    "layer-iv": layer_iv,
    "disorder-effects": disorder_effects,
    "connectivity-r": connectivity_r,
}


def synthetic_map(path: Path) -> None:
    """The z map of the overlays figure: three Gaussian blobs over smoothed noise, in MNI152NLin2009cAsym."""
    import nibabel as nib
    import numpy as np
    from scipy.ndimage import gaussian_filter

    shape = (97, 115, 97)
    affine = np.array(
        [[2, 0, 0, -96], [0, 2, 0, -132], [0, 0, 2, -78], [0, 0, 0, 1]], float
    )
    noise = gaussian_filter(
        np.random.default_rng(0).standard_normal(shape), sigma=2, mode="wrap"
    )
    noise *= 0.5 / noise.std()
    grid = np.stack(np.meshgrid(*(np.arange(n) for n in shape), indexing="ij"), axis=-1)
    world = grid @ affine[:3, :3].T + affine[:3, 3]
    blobs = ((7, (-42, 22, 6)), (6, (-48, -60, -8)), (-6, (-38, -68, 42)))
    for peak, centre in blobs:
        noise += peak * np.exp(-((world - centre) ** 2).sum(axis=-1) / (2 * 10**2))
    image = nib.Nifti1Image(noise.astype(np.float32), affine)
    image.header.set_intent("z score")
    image.set_sform(affine, code=4)
    image.set_qform(affine, code=4)
    nib.save(image, path)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--dpi", type=float, required=True)
    parser.add_argument("jobs", nargs="+")
    options = parser.parse_args()

    import matplotlib

    matplotlib.use("Agg")
    from matplotlib import font_manager
    from matplotlib import pyplot as plt

    font = regular_font(options.out)
    font_manager.fontManager.addfont(font)
    plt.rcParams.update(
        {
            "font.family": font_manager.FontProperties(fname=font).get_name(),
            "font.size": TEXT_PT,
            "axes.unicode_minus": True,
        }
    )
    for job in options.jobs:
        if "=" in job:
            name, path = job.split("=", 1)
            if name != "synthetic":
                sys.exit(f"Unknown map: {name}")
            synthetic_map(Path(path))
            continue
        name, size = job.split(":")
        if name not in PLOTS:
            sys.exit(f"Unknown plot: {name}")
        width, height = (int(side) for side in size.split("x"))
        for theme, ink in INKS.items():
            figure = plt.figure(
                figsize=(width / options.dpi, height / options.dpi), dpi=options.dpi
            )
            PLOTS[name](figure, ink)
            fit(figure)
            for text in figure.findobj(matplotlib.text.Text):
                text.set_color(ink)
            figure.savefig(
                options.out / f"{name}-{theme}.png",
                transparent=True,
                metadata={"Software": None},
            )
            plt.close(figure)


if __name__ == "__main__":
    main()
