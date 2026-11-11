import type { LoadProgress, Manifest, SurfaceColor } from '../../types/index.ts';
import type { OnProgress } from '../../engine/api.ts';
import { LOBE_ATLAS, groupsByLobe } from '../catalog/lobes.ts';
import { failureKey, failureNotice } from '../i18n/errors.ts';
import { atlasSwitchLabel, t } from '../i18n/index.ts';
import { clinicalLayers, showClinicalRegions } from './clinical-navigation.ts';
import type { ModelPort, SectionsPort } from './ports.ts';
import type { Session } from './session.ts';

/** Whether a subject publishes the spinal cord; a scan ending inside the medulla does not. */
export const publishesSpinalCord = (manifest: Pick<Manifest, 'supplemental_layers'>): boolean =>
  (manifest.supplemental_layers ?? []).some((layer) => layer.id === 'pam50');

/**
 * The atlas a colouring needs shown, were `atlas` the one on screen: CAB-NP is defined on one
 * atlas's areas, and lobes only on an atlas grouped by lobe, which any such atlas satisfies.
 */
export const requiredAtlas = (
  { cabNp }: Pick<ModelPort, 'cabNp'>,
  colour: SurfaceColor,
  atlas: string,
): string | null | undefined =>
  colour === 'cab-np'
    ? cabNp?.atlas
    : colour === 'lobe' && !groupsByLobe(atlas)
      ? LOBE_ATLAS
      : null;

/**
 * The scene changes that wait on downloads: layer switches, surface colours and
 * drawing a set of regions. One intent token orders them: a command takes
 * `const current = begin()` and, after every await, stops once `current()` is
 * false, because a later command now owns the scene. Downloads report in the
 * status bar as the masthead's switches always have; failures become notices.
 */
export function createSceneCommands({
  model,
  sections,
  session,
  render,
}: {
  model: ModelPort;
  sections: SectionsPort;
  session: Pick<Session, 'assemble' | 'notify' | 'resolveNotice' | 'setSwitching' | 'endSwitching'>;
  render: () => void;
}) {
  let intent = 0;
  const downloads = new Map<symbol, LoadProgress | null>();
  // The layer each switch through these commands last asked the model for, while it loads.
  let atlasWanted: string | null = null;
  let detailWanted: string | null = null;

  function begin(): () => boolean {
    const mine = ++intent;
    return () => mine === intent && !model.disposed;
  }

  const lang = () => session.assemble({}).lang;

  /** A failure as an error notice; `retry` runs the command again, offered for a failed download. */
  function fail(operation: string, error: unknown, subject?: string, retry?: () => void) {
    console.error(error);
    session.notify(failureNotice(error, lang(), operation, subject, retry));
    render();
  }

  /** The command a failure named has now done what it failed to: its error goes, by whichever route. */
  function succeeded(operation: string, subject?: string) {
    session.resolveNotice(failureKey(operation, subject));
  }

  /** A failure is the reader's to hear only while its command still owns the scene. */
  function failIfCurrent(
    current: () => boolean,
    operation: string,
    error: unknown,
    subject?: string,
    retry?: () => void,
  ) {
    if (current()) fail(operation, error, subject, retry);
    else console.error(error);
  }

  /**
   * A masthead field's failure, keyed by the field (atlas, detail, colour) rather than its choice:
   * the field's next failure takes its place, and its next success, by any route, retires it.
   */
  function failChoice(
    current: () => boolean,
    field: 'atlas' | 'detail' | 'colour',
    error: unknown,
    [operation, subject]: [string, string],
    retry: () => void,
  ) {
    console.error(error);
    if (!current()) return;
    session.notify({ ...failureNotice(error, lang(), operation, subject, retry), key: field });
    render();
  }

  function showProgress() {
    const known = [...downloads.values()].filter((progress) => progress !== null);
    if (!downloads.size) session.endSwitching();
    else {
      session.setSwitching(
        known.length
          ? {
              loaded: known.reduce((sum, progress) => sum + progress.loaded, 0),
              total: known.reduce((sum, progress) => sum + progress.total, 0),
            }
          : null,
      );
    }
    render();
  }

  async function download<T>(load: (onProgress: OnProgress) => Promise<T>): Promise<T> {
    const key = Symbol('download');
    downloads.set(key, null);
    showProgress();
    try {
      return await load((progress) => {
        if (!progress?.total) return;
        downloads.set(key, progress);
        showProgress();
      });
    } finally {
      downloads.delete(key);
      showProgress();
    }
  }

  const fetching = (id: string, load: (onProgress?: OnProgress) => Promise<void>) =>
    model.hasLayer(id) ? load() : download(load);

  /**
   * Show this atlas. Asking for the one on screen while another is still
   * loading re-asks the model for it, so the older switch does not land later.
   */
  async function loadAtlas(id: string, current: () => boolean) {
    if (id === model.settings.atlas && (atlasWanted ?? id) === id) return;
    atlasWanted = id;
    try {
      await fetching(id, (progress) => model.setAtlas(id, progress));
    } finally {
      if (atlasWanted === id) atlasWanted = null;
    }
    if (current() && model.settings.atlas !== id) throw new Error(`Atlas not applied: ${id}`);
    if (model.settings.atlas === id) session.resolveNotice('atlas');
  }

  async function loadDetail(id: string, current: () => boolean) {
    if (id === model.settings.detail && (detailWanted ?? id) === id) return;
    detailWanted = id;
    try {
      await fetching(id, (progress) => model.setDetail(id, progress));
    } finally {
      if (detailWanted === id) detailWanted = null;
    }
    if (current() && model.settings.detail !== id) {
      throw new Error(`Detail level not applied: ${id}`);
    }
    if (model.settings.detail === id) session.resolveNotice('detail');
  }

  const hasSpinalCord = () => publishesSpinalCord(model.manifest);

  // The model shares each download; asking first, with progress, is what puts it in the status bar.
  const envelopes = () =>
    model.envelopesLoaded ? null : download((progress) => model.ensureEnvelopes(progress));
  const spinalCord = () =>
    model.spinalCordLoad === 'ready'
      ? null
      : download((progress) => model.ensureSpinalCord(progress));

  /** Colour the surface, first showing the atlas a network colouring is defined on. */
  async function applySurfaceColor(value: SurfaceColor, current: () => boolean) {
    const atlas = requiredAtlas(model, value, model.settings.atlas);
    if (atlas) await loadAtlas(atlas, current);
    if (!current()) return false;
    // Through the sections even when the colour is already shown, so an older colour still loading is overtaken.
    const colour = () => sections.setSurfaceColor(value, current);
    // The scan is a download of its own.
    if (value === 'mri' && value !== model.settings.surfaceColor) await download(colour);
    else await colour();
    if (model.settings.surfaceColor === value) session.resolveNotice('colour');
    return current();
  }

  /** Show or hide the spinal cord; its first showing downloads it. */
  async function showSpinalCord(visible: boolean, current: () => boolean) {
    if (visible && !hasSpinalCord())
      throw new Error('This anatomy does not publish a spinal cord.');
    await (visible && model.spinalCordLoad !== 'ready'
      ? download((progress) => model.setSpinalCordVisible(true, progress))
      : model.setSpinalCordVisible(visible));
    if (visible && model.spinalCordLoad === 'ready') succeeded('cord');
    return current();
  }

  /** The first cut downloads the tissue envelopes it caps, and the cord where one is published. */
  async function prepareCut(current: () => boolean) {
    if (!sections.solidsReady)
      await Promise.all([envelopes(), hasSpinalCord() ? spinalCord() : null]);
    return current();
  }

  async function cut(mode: Parameters<SectionsPort['setMode']>[0], current: () => boolean) {
    if (mode === 'off' || sections.solidsReady) await sections.setMode(mode);
    else await Promise.all([prepareCut(current), download(() => sections.setMode(mode))]);
    return current();
  }

  /** Draw cited regions together on the layers that hold most of them, without a misleading cut. */
  async function revealRegions(ids: readonly string[], current: () => boolean) {
    const layers = clinicalLayers(model, ids);
    if (!ids.length) return current();
    await loadAtlas(layers.atlas ?? model.settings.atlas, current);
    if (!current()) return false;
    await loadDetail(layers.detail ?? model.settings.detail, current);
    if (!current()) return false;
    await sections.setMode('off');
    if (!current()) return false;
    showClinicalRegions(model, ids);
    return true;
  }

  async function openRegion(id: string, current: () => boolean) {
    if (!(await revealRegions([id], current))) return false;
    if (model.regions.get(id)!.atlas === 'pam50' && !(await showSpinalCord(true, current))) {
      return false;
    }
    model.select(id);
    return true;
  }

  /**
   * The masthead's atlas field. A colouring the new atlas cannot carry is dropped; the option
   * said so before it was chosen. Each masthead choice retires the information an earlier one left,
   * and its success the field's earlier error.
   */
  async function chooseAtlas(id: string) {
    if (id === model.settings.atlas && atlasWanted === null) return;
    const current = begin();
    session.notify(null);
    try {
      await loadAtlas(id, current);
    } catch (error) {
      failChoice(current, 'atlas', error, ['layer', atlasSwitchLabel(id, lang())], () => {
        void chooseAtlas(id);
      });
      return;
    }
    if (current()) render();
  }

  async function chooseDetail(id: string) {
    if (id === model.settings.detail && detailWanted === null) return;
    const current = begin();
    session.notify(null);
    try {
      await loadDetail(id, current);
    } catch (error) {
      failChoice(current, 'detail', error, ['layer', atlasSwitchLabel(id, lang())], () => {
        void chooseDetail(id);
      });
      return;
    }
    if (current()) render();
  }

  /** The masthead's colour field; an atlas it switches to was named in the option. */
  async function chooseSurfaceColor(value: SurfaceColor) {
    const current = begin();
    session.notify(null);
    try {
      if (!(await applySurfaceColor(value, current))) return;
    } catch (error) {
      const said = t(lang(), 'display').surfaceColors[value];
      failChoice(current, 'colour', error, ['colour', said], () => {
        void chooseSurfaceColor(value);
      });
      return;
    }
    render();
  }

  return {
    begin,
    fail,
    failIfCurrent,
    succeeded,
    download,
    loadAtlas,
    loadDetail,
    applySurfaceColor,
    showSpinalCord,
    prepareCut,
    cut,
    revealRegions,
    openRegion,
    chooseAtlas,
    chooseDetail,
    chooseSurfaceColor,
  };
}

export type SceneCommands = ReturnType<typeof createSceneCommands>;
