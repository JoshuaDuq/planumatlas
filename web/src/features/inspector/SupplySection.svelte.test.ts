import { expect, test } from 'vitest';
import { render } from 'vitest-browser-svelte';
import manifest from '../../../../public/models/mni152/manifest.json';
import type { ArterialTerritories, Region } from '../../lib/types/index.ts';
import '../../app/layout.css';
import SupplySection from './SupplySection.svelte';

// The MNI template measured no landing error, so its territories carry no small-structure rule.
const territories = manifest.arterial_territories as unknown as ArterialTerritories;
const region = (id: string) =>
  manifest.regions.find((entry) => entry.id === id) as unknown as Region;

test('on the template a region lists its territories, and a structure under 100 mm³ has no section', async () => {
  expect(territories.small).toBeNull();
  const screen = await render(SupplySection, {
    region: region('destrieux:left:14'),
    lang: 'en',
    territories,
  });
  const supply = screen.container.querySelector('details')!;
  supply.open = true;
  expect(supply.textContent).toContain('Middle cerebral artery, frontal');
  // The paracentral nucleus of the thalamus, 99 mm³ here; on CDMD it names the territory round it.
  const small = region('nextbrain:left:285');
  expect(small.segmentation_volume_mm3).toBeLessThan(100);
  await screen.rerender({ region: small });
  expect(screen.container.querySelector('details')).toBeNull();
});
