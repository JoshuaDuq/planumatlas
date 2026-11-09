// index.html states counts the published data owns; each is held equal to its source.
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { readRepoJson, readRepoYaml } from '../../test/repo.ts';

const index = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const WORDS: Record<string, number> = { four: 4, five: 5 };

/** Every count the page states before `noun`, as numbers. */
function stated(noun: string): number[] {
  const counts = [...index.matchAll(new RegExp(`\\b(\\d+|four|five) ${noun}`, 'g'))].map(
    ([, count]) => WORDS[count!] ?? Number(count),
  );
  expect(counts, noun).not.toHaveLength(0);
  return counts;
}

interface Manifest {
  atlases: { id: string; region_count: number }[];
  regions: { atlas: string }[];
}

test('the page copy states the published counts', () => {
  const manifest = readRepoJson<Manifest>('public/models/cdmd/manifest.json');
  const atlas = (id: string) => manifest.atlases.find((entry) => entry.id === id)!.region_count;
  const nextbrain = manifest.regions.filter((region) => region.atlas === 'nextbrain').length;
  const domains = readRepoJson<{ domains: unknown[] }>(
    'public/models/cdmd/neuropsych-domains.json',
  );
  const tracts = readRepoYaml<{ bundles: unknown[] }>('data/diffusion-cdmd.yaml');
  const deficits = readRepoYaml<{ deficits: unknown[] }>('data/neuropsychology.yaml');
  const circuits = readRepoYaml<{ circuits: unknown[] }>('data/circuits.yaml');

  expect(stated('cortical atlases')).toEqual([manifest.atlases.length]);
  expect(stated('Destrieux regions')).toEqual([atlas('destrieux')]);
  expect(stated('HCP-MMP areas')).toEqual([atlas('hcp-mmp')]);
  expect([...stated('NextBrain labels'), ...stated('histological labels')]).toEqual([
    nextbrain,
    nextbrain,
  ]);
  expect(stated('diffusion tracts')).toEqual([tracts.bundles.length]);
  expect(stated('function maps')).toEqual([domains.domains.length]);
  expect(stated('deficit profiles')).toEqual([deficits.deficits.length]);
  expect(stated('guided tours')).toEqual([circuits.circuits.length]);
});
