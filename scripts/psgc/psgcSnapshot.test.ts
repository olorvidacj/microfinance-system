import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/**
 * Integrity of the committed PSGC snapshot.
 *
 * `npm run psgc:verify` cross-checks against the PSA over the network, which is
 * the right check to run when refreshing the data and the wrong one to gate CI on
 * (an unauthenticated api.github.com call rate-limits at 60/hour). These tests do
 * the offline half instead: the snapshot must be internally consistent and must
 * match the counts recorded in its own metadata, so a truncated or partially
 * regenerated file fails the build instead of silently shipping missing
 * barangays.
 */

const here = dirname(fileURLToPath(import.meta.url));
const SNAPSHOT = join(here, '..', '..', 'database', 'data', 'psgc', 'PSGC_20260927.json');

type Row = Record<string, string | number | null>;
interface Snapshot {
  meta: { edition: string; source: string; counts: Record<string, number> };
  regions: Row[];
  provinces: Row[];
  cities: Row[];
  barangays: Row[];
  postalCodes: Row[];
}

const snapshot = JSON.parse(readFileSync(SNAPSHOT, 'utf8')) as Snapshot;

describe('PSGC snapshot', () => {
  it('matches the counts recorded in its own metadata', () => {
    for (const key of ['regions', 'provinces', 'cities', 'barangays', 'postalCodes'] as const) {
      expect(snapshot[key].length, `${key} count`).toBe(snapshot.meta.counts[key]);
    }
  });

  it('has the expected shape for the Philippines', () => {
    expect(snapshot.regions).toHaveLength(17);
    expect(snapshot.provinces.length).toBeGreaterThan(80);
    expect(snapshot.barangays.length).toBeGreaterThan(40_000);
  });

  it('records its edition and provenance', () => {
    expect(snapshot.meta.edition).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(snapshot.meta.source).toMatch(/Statistics Authority|PSGC/);
  });

  it('has unique codes at every level', () => {
    for (const key of ['regions', 'provinces', 'cities', 'barangays'] as const) {
      const codes = snapshot[key].map((r) => r.code);
      expect(new Set(codes).size, `${key} codes are unique`).toBe(codes.length);
    }
  });

  it('resolves every foreign key up to the region', () => {
    const regionCodes = new Set(snapshot.regions.map((r) => r.code as string));
    const provinceCodes = new Set(snapshot.provinces.map((p) => p.code as string));
    const cityCodes = new Set(snapshot.cities.map((c) => c.code as string));

    // A barangay whose province or city is missing would be unselectable in the
    // guided address form, which is a silent data-loss bug rather than a loud one.
    for (const p of snapshot.provinces) {
      expect(regionCodes.has(p.regionCode as string), `province ${p.code}`).toBe(true);
    }
    for (const c of snapshot.cities) {
      // Cities in the National Capital Region have no province, by design.
      if (c.provinceCode) {
        expect(provinceCodes.has(c.provinceCode as string), `city ${c.code}`).toBe(true);
      }
      expect(regionCodes.has(c.regionCode as string), `city ${c.code} region`).toBe(true);
    }
    for (const b of snapshot.barangays) {
      expect(cityCodes.has(b.cityCode as string), `barangay ${b.code}`).toBe(true);
    }
  });

  it('maps every barangay to a postal code, and every postal row to a barangay', () => {
    const barangayCodes = new Set(snapshot.barangays.map((b) => b.code as string));
    const rows = snapshot.postalCodes;

    // One row per barangay, so the mapping is a bijection on barangayCode.
    const mapped = new Set(rows.map((p) => p.barangayCode as string));
    expect(mapped.size, 'one postal row per barangay').toBe(rows.length);
    expect(barangayCodes.size, 'every barangay has a postal code').toBe(mapped.size);
    for (const p of rows) {
      expect(barangayCodes.has(p.barangayCode as string), `postal row ${p.barangayCode}`).toBe(true);
    }
  });

  it('does not pretend a ZIP code identifies one barangay', () => {
    // A ZIP covers a city or municipality, so thousands of barangays share one.
    // Asserting uniqueness here would be asserting something false about the
    // Philippines -- the 42,036 rows carry 1,587 distinct ZIPs, and that is correct.
    const zips = snapshot.postalCodes.map((p) => p.postalCode as string);
    const distinct = new Set(zips);
    expect(distinct.size).toBeLessThan(zips.length);
    expect(distinct.size).toBeGreaterThan(1000);
  });
});
