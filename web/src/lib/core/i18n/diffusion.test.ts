import assert from 'node:assert/strict';
import { test } from 'vitest';
import { diffusionError } from './diffusion.ts';

test('a diffusion failure is worded from its code, in both languages', () => {
  for (const code of ['asset-fetch', 'asset-updated', 'invalid-data', 'failed'] as const) {
    for (const lang of ['en', 'fr']) assert.ok(diffusionError(lang, code), `${lang} ${code}`);
    assert.notEqual(diffusionError('en', code), diffusionError('fr', code));
  }
});

test('I18N-21 · a diffusion failure is worded from its code and never with the error message', () => {
  const words = {
    en: {
      'asset-fetch':
        'The reference data could not be downloaded. Check the connection, then try again.',
      'asset-updated':
        'A reference data file on the server no longer matches this page; Planum has probably been updated. Reload the page to continue.',
      'invalid-data': 'The reference data could not be read.',
      failed: 'The reference data could not be displayed.',
    },
    fr: {
      'asset-fetch':
        'Les données de référence n’ont pas pu être téléchargées. Vérifiez la connexion, puis réessayez.',
      'asset-updated':
        'Un fichier de données de référence du serveur ne correspond plus à cette page\u202f; Planum a probablement été mis à jour. Rechargez la page pour continuer.',
      'invalid-data': 'Les données de référence n’ont pas pu être lues.',
      failed: 'Les données de référence n’ont pas pu être affichées.',
    },
  } as const;
  for (const lang of ['en', 'fr'] as const) {
    for (const [code, text] of Object.entries(words[lang])) {
      assert.equal(diffusionError(lang, code as keyof (typeof words)['en']), text);
    }
  }
});
