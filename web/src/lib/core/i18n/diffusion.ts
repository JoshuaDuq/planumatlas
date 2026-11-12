import * as diffusionText from './areas/diffusion.ts';
import { t } from './index.ts';

/** The stable codes a diffusion-panel failure is shown by; the English detail stays in the console. */
export type DiffusionErrorCode = keyof typeof diffusionText.en.errors;

/**
 * The words for a failure's code. The legacy `diffusionError(lang, error)` also derived the code
 * from the error (diffusion/translations.js:63): an AssetError's own code, `invalid-data` for a
 * DiffusionInputError, `failed` for anything else. That moves to C3 beside DiffusionInputError (T1 and T2 import it).
 */
export const diffusionError = (lang: string, code: DiffusionErrorCode): string =>
  t(lang, 'diffusion').errors[code];
