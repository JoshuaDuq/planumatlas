// What the Linked MRI dialog says: the structure under the crosshair, the readout, and the names of
// each plane's controls. Fixed expected words; the legacy source is not imported (decision on #4,
// 2026-10-26: tests state business rules).
import { describe, expect, test } from 'vitest';
import { stagedFrame } from '../../lib/engine/slices/coordinates.ts';
import {
  canvasName,
  planeName,
  pngFileName,
  positionLabel,
  readoutText,
  sampleName,
  saveSuffix,
  seenFrom,
  sideConvention,
  savedAnnouncement,
} from './mpr-words.ts';

describe('what the crosshair is on', () => {
  test.each([
    ['Left-Cerebral-White-Matter', 'en', 'Cerebral white matter'],
    ['Left-Cerebral-White-Matter', 'fr', 'Substance blanche cérébrale'],
    ['CSF', 'en', 'Cerebrospinal fluid (CSF)'],
    ['Unknown', 'fr', 'Non étiqueté'],
    ['3rd-Ventricle', 'en', 'Third ventricle'],
    ['3rd-Ventricle', 'fr', 'Troisième ventricule'],
  ] as const)(
    '%s is worded "%s" in %s: tissues first, then the aseg structures',
    (raw, lang, name) => {
      expect(sampleName(raw, lang)).toBe(name);
    },
  );

  test('a cortical parcel drops its hemisphere prefix to find its Destrieux name', () => {
    expect(sampleName('ctx_lh_G_front_sup', 'en')).toBe('Superior frontal gyrus');
    expect(sampleName('ctx_rh_G_front_sup', 'fr')).toBe('Gyrus frontal supérieur');
  });

  test('an HCP-MMP area loses its side and suffix; any other name is shown as the volume gives it', () => {
    expect(sampleName('L_V1_ROI', 'en')).toBe('V1');
    expect(sampleName('Brain-Stem-Part', 'en')).toBe('Brain-Stem-Part');
  });

  test('a sample with no name has no words', () => {
    expect(sampleName('', 'en')).toBe('');
  });
});

describe('the readout', () => {
  const position = '+1.0, −2.0, +3.0 mm';

  test('gives the position, the structure and its label number', () => {
    expect(readoutText(position, { name: 'CSF', labelId: 24, agreement: null }, 'en')).toBe(
      `${position} — Cerebrospinal fluid (CSF) (label 24)`,
    );
    expect(readoutText(position, { name: 'CSF', labelId: 24, agreement: null }, 'fr')).toBe(
      `${position} — Liquide cérébro-spinal (LCS) (étiquette 24)`,
    );
  });

  test('the region the cut labels name leads, then the structure and its label number', () => {
    const sample = { name: 'Left-Cerebral-Cortex', labelId: 3, agreement: null };
    const opercular = 'Opercular part of the inferior frontal gyrus';
    expect(readoutText(position, sample, 'en', opercular)).toBe(
      `${position} — ${opercular} · Left cerebral cortex (label 3)`,
    );
    // A structure the cut atlas names as the segmentation does is said once.
    expect(readoutText(position, sample, 'en', 'Left cerebral cortex')).toBe(
      `${position} — Left cerebral cortex (label 3)`,
    );
  });

  test('a sample with no name is unlabelled, never "(label undefined)"', () => {
    const empty = readoutText(
      position,
      { name: '', labelId: undefined as unknown as number, agreement: null },
      'en',
    );
    expect(empty).toBe(`${position} — Unlabelled`);
    expect(readoutText(position, { name: '', labelId: 0, agreement: null }, 'fr')).toBe(
      `${position} — Non étiqueté`,
    );
  });

  test('where agreement is shown, says which segmentation labels the structure there', () => {
    const sample = { name: 'Left-Hippocampus', labelId: 17, agreement: 'aseg-only' } as const;
    expect(readoutText(position, sample, 'en')).toMatch(/\(label 17\) · aseg only$/);
    expect(readoutText(position, { ...sample, agreement: 'nextbrain-only' }, 'fr')).toMatch(
      /\(étiquette 17\) · NextBrain seule$/,
    );
  });
});

describe("the names of a plane's controls", () => {
  test('the slider is named by its visible words', () => {
    expect(positionLabel('sagittal', 'en')).toBe('Sagittal position');
    expect(positionLabel('axial', 'fr')).toBe('Position axiale');
  });

  test('Save PNG says whose picture it saves after the words it shows', () => {
    expect(`Save PNG${saveSuffix('coronal', 'en')}`).toBe('Save PNG, coronal');
    expect(`Enregistrer PNG${saveSuffix('axial', 'fr')}`).toBe('Enregistrer PNG, axial');
  });

  test("saving is confirmed in the reader's language", () => {
    expect(savedAnnouncement('axial', 'en')).toBe('Saved the axial section as a PNG.');
    expect(savedAnnouncement('sagittal', 'fr')).toBe('Coupe sagittale enregistrée au format PNG.');
  });

  test('the file is named by subject, plane and offset to one decimal', () => {
    expect(pngFileName('sub_013', 'axial', 12.345)).toBe('sub_013-axial-12.3mm.png');
    expect(pngFileName('sub_013', 'sagittal', -4)).toBe('sub_013-sagittal--4.0mm.png');
  });

  test("plane names are the dialog's headings", () => {
    expect(planeName('coronal', 'fr')).toBe('Coronal');
  });
});

describe("the picture's text alternative", () => {
  test('says how to use it and spells out which way each edge faces, since the letters are in the bitmap', () => {
    expect(canvasName('axial', ['A', 'R', 'P', 'L'], 'en')).toBe(
      'Axial MRI. Click to place the crosshair; use the position slider to change slice. Anterior at the top, patient right at the right, posterior at the bottom, patient left at the left.',
    );
    expect(canvasName('sagittal', ['S', 'P', 'I', 'A'], 'fr')).toBe(
      'Coupe IRM sagittale. Cliquez pour placer le réticule ; utilisez le curseur de position pour changer de coupe. Supérieur en haut, postérieur à droite, inférieur en bas, antérieur à gauche.',
    );
  });

  test('an oblique frame has no edges to spell, and that is an error rather than a blank', () => {
    expect(() => canvasName('axial', [], 'en')).toThrow(RangeError);
    expect(() => canvasName('axial', ['A', 'R', 'P', 'X'], 'en')).toThrow(/Unknown orientation/);
  });
});

test('each panel names the side it is seen from by its own edge letters, as the stage faces each cut', () => {
  for (const [plane, reverse, side] of [
    ['sagittal', false, 'right'],
    ['sagittal', true, 'left'],
    ['coronal', false, 'anterior'],
    ['coronal', true, 'posterior'],
    ['axial', false, 'superior'],
    ['axial', true, 'inferior'],
  ] as const) {
    expect(seenFrom(plane, stagedFrame(plane, [0, 0, 0], reverse).edges), plane).toBe(side);
  }
  expect(() => seenFrom('axial', ['R', 'A', 'L', 'P'])).toThrow('axial panel');
});

test('an axial or coronal panel names its convention by the side at its left edge; a sagittal one has none', () => {
  // Seen from above, the patient's left is on the screen's left; seen from the front, their right.
  for (const [plane, reverse, convention] of [
    ['axial', false, 'neurological'],
    ['axial', true, 'radiological'],
    ['coronal', false, 'radiological'],
    ['coronal', true, 'neurological'],
    ['sagittal', false, null],
  ] as const) {
    const { edges } = stagedFrame(plane, [0, 0, 0], reverse);
    expect(sideConvention(edges), `${plane} ${reverse}`).toBe(convention);
  }
});
