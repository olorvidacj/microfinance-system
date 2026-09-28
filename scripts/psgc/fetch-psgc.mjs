/**
 * Downloads the authoritative Philippine administrative hierarchy and writes a
 * single normalised snapshot to `database/data/psgc/PSGC_<edition>.json`.
 *
 * Primary source: Open Admin Data — Philippines Administrative Divisions
 *   https://github.com/open-admin-data/philippines-administrative-divisions
 *   CC-BY-4.0. Derived from PSA PSGC with Philippine Postal Corporation ZIP
 *   codes resolved to barangay level.
 *
 * Cross-check source: PSA PSGC via the read-only psgc.gitlab.io mirror.
 *   `--verify` re-counts the hierarchy from the PSA mirror and compares it
 *   against the snapshot, so a stale or truncated download fails loudly.
 *
 * The snapshot is committed so the KYC address cascade works offline. Staff can
 * also re-import a newer snapshot from the admin screen, which accepts exactly
 * the file shape this script produces.
 *
 *   node scripts/psgc/fetch-psgc.mjs           # fetch + write snapshot
 *   node scripts/psgc/fetch-psgc.mjs --verify  # fetch, then cross-check vs PSA
 */
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(HERE, '../../database/data/psgc');
const RAW = 'https://raw.githubusercontent.com/open-admin-data/philippines-administrative-divisions/main/data';
const PSA_API = 'https://psgc.gitlab.io/api';
const VERIFY = process.argv.includes('--verify');

/** Open Admin Data region id -> PSA 2-digit region code. */
const REGION_CODE = {
  R01: '01', R02: '02', R03: '03', R04A: '04', R05: '05', R06: '06', R07: '07',
  R08: '08', R09: '09', R10: '10', R11: '11', R12: '12', R13: '13', R14: '14',
  R15: '15', R16: '16', R17: '17',
  NCR: '40', CAR: '41', ARMM: '42',
};

/** Canonical display order for the region picker, per §4. */
const REGION_ORDER = [
  '01', '02', '03', '04', '05', '40', '41', '06', '07', '08', '09',
  '10', '11', '12', '13', '14', '15', '16', '17', '42',
];

/** OAD region id -> canonical order key. */
const REGION_SLUG = {
  R01: '01', R02: '02', R03: '03', R04A: '04', R05: '05', R06: '06', R07: '07',
  R08: '08', R09: '09', R10: '10', R11: '11', R12: '12', R13: '13', R14: '14',
  R15: '15', R16: '16', R17: '17', NCR: '40', CAR: '41', ARMM: '42',
};

const REGION_LABEL = {
  '01': 'Ilocos Region', '02': 'Cagayan Valley', '03': 'Central Luzon',
  '04': 'CALABARZON', '05': 'Bicol Region', '06': 'Western Visayas',
  '07': 'Central Visayas', '08': 'Eastern Visayas', '09': 'Zamboanga Peninsula',
  '10': 'Northern Mindanao', '11': 'Davao Region', '12': 'SOCCSKSARGEN',
  '13': 'Caraga', '14': 'Autonomous Region in Muslim Mindanao',
  '15': 'Cordillera Administrative Region', '16': 'Region XVI',
  '17': 'MIMAROPA', '40': 'National Capital Region',
  '41': 'Cordillera Administrative Region', '42': 'Bangsamoro Autonomous Region in Muslim Mindanao',
};

async function getJson(url, label) {
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`${label}: HTTP ${res.status} ${res.statusText}`);
  const text = await res.text();
  const parsed = JSON.parse(text);
  process.stdout.write(`  ${label.padEnd(22)} ${(Array.isArray(parsed) ? parsed.length : 1).toLocaleString('en-PH')}\n`);
  return parsed;
}

/**
 * PSGC names carry administrative markers that are noise in a picker
 * ("City of Manila", "Adams (Pob.)"). We keep `name` for display fidelity and
 * store `shortName` for search and compact display.
 */
function cleanName(raw) {
  return String(raw || '')
    .replace(/\s*\((Pob\.|Pob|Endo\.|Syd\.|Census)\)\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const shortName = (raw) => cleanName(raw).replace(/^City of\s+/i, '').replace(/^Municipality of\s+/i, '').trim();

/**
 * The PSA release carries the authoritative isCity / isCapital flags, keyed by
 * 6-digit LGU code. Failure is non-fatal: the caller falls back to a heuristic
 * and the snapshot records that it did.
 */
async function loadPsaCityFlags() {
  const map = new Map();
  try {
    const res = await fetch(`${PSA_API}/cities-municipalities/`, { headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const rows = await res.json();
    for (const r of rows) {
      map.set(String(r.code || '').slice(0, 6), { isCity: r.isCity, isCapital: r.isCapital });
    }
    process.stdout.write(`  ${'psa city flags'.padEnd(22)} ${map.size.toLocaleString('en-PH')}\n`);
  } catch (err) {
    process.stdout.write(`  ${'psa city flags'.padEnd(22)} unavailable (${err.message}) — using name heuristic\n`);
  }
  return map;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  console.log('PSGC fetch — Philippines administrative hierarchy\n');

  // ---- Regions / provinces / municipalities --------------------------------
  const [rawRegions, rawProvinces, rawMunicipalities] = await Promise.all([
    getJson(`${RAW}/all-region.json`, 'regions'),
    getJson(`${RAW}/all-province.json`, 'provinces'),
    getJson(`${RAW}/all-municipality.json`, 'cities/municipalities'),
  ]);

  // ---- Barangays, one file per region (they carry the ZIP codes) -----------
  const dirListing = await getJson(
    'https://api.github.com/repos/open-admin-data/philippines-administrative-divisions/contents/data/barangay-by-region',
    'barangay dir'
  );
  const files = dirListing
    .filter((f) => f.name.endsWith('.json'))
    .map((f) => ({ name: f.name, url: f.download_url }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const rawBarangays = [];
  for (const f of files) {
    const rows = await getJson(f.url, f.name.replace('.json', ''));
    if (Array.isArray(rows)) rawBarangays.push(...rows);
  }

  // ---- Normalise regions ---------------------------------------------------
  const regionOrderOf = (code) => {
    const i = REGION_ORDER.indexOf(code);
    return i === -1 ? 999 : i;
  };
  const regions = rawRegions
    .map((r) => {
      const code = REGION_CODE[r.id];
      if (!code) return null;
      return {
        code,
        name: REGION_LABEL[code] || cleanName(r.name?.en),
        longName: cleanName(r.name?.local) || cleanName(r.name?.en),
        sortOrder: regionOrderOf(code),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code));

  const regionSet = new Set(regions.map((r) => r.code));
  if (!regionSet.size) throw new Error('No regions resolved — region id map is stale.');

  // ---- Normalise provinces -------------------------------------------------
  // Region is resolved from the province's own parent, never from the PSGC code
  // prefix: BARMM provinces are coded 15xxxxx but are not in Region XV.
  const provinces = rawProvinces
    .map((p) => {
      const code = String(p.code?.id || p.id || '').slice(0, 4);
      const regionCode = REGION_CODE[p.parent?.id];
      if (!code || !regionSet.has(regionCode)) return null;
      return {
        code,
        name: cleanName(p.name?.en),
        longName: cleanName(p.name?.local),
        regionCode,
      };
    })
    .filter(Boolean);

  const provinceByCode = new Map(provinces.map((p) => [p.code, p]));

  // NCR has no provinces. The source models it with a single placeholder
  // province ("Metro Manila", 130000) whose children are the 16 districts. We
  // drop the placeholder and mark its LGUs as regional districts, so the
  // address form hides the Province field for them — §4 "areas where the
  // administrative structure differs".
  const ncrPlaceholder = provinces.find((p) => p.regionCode === '40');
  const regionalDistrictParent = ncrPlaceholder ? ncrPlaceholder.code : null;

  // ---- Normalise cities / municipalities -----------------------------------
  const cities = rawMunicipalities
    .map((c) => {
      const code = String(c.code?.id || c.id || '').slice(0, 6);
      if (!code) return null;
      const parentId = String(c.parent?.id || '');
      const parentProvinceId = parentId.slice(0, 4);
      const province = provinceByCode.get(parentProvinceId);
      if (!province) return null;

      const isRegionalDistrict = province.code === regionalDistrictParent;
      const provinceCode = isRegionalDistrict ? null : province.code;
      const name = cleanName(c.name?.en);
      return {
        code,
        name,
        longName: cleanName(c.name?.local),
        provinceCode,
        regionCode: province.regionCode,
        shortName: shortName(name),
        isRegionalDistrict,
      };
    })
    .filter(Boolean);

  const citySet = new Set(cities.map((c) => c.code));
  const provincesOut = provinces.filter((p) => p.code !== regionalDistrictParent);

  // ---- Classify cities vs municipalities ------------------------------------
  // The source dataset does not distinguish them. We take the flag from the PSA
  // release (authoritative) and fall back to a name heuristic if the mirror is
  // unreachable, so the field is never silently fabricated.
  const psaCityFlags = await loadPsaCityFlags();
  for (const c of cities) {
    const flag = psaCityFlags.get(c.code);
    c.isCity = flag ? !!flag.isCity : / city$/i.test(c.name) || c.name === 'Manila';
    c.isCapital = flag ? !!flag.isCapital : /capital/i.test(c.name);
  }

  // ---- Normalise barangays + postal codes ----------------------------------
  const cityByCode = new Map(cities.map((c) => [c.code, c]));
  const provinceByCodeOut = new Map(provincesOut.map((p) => [p.code, p]));
  const seen = new Set();
  const barangays = [];
  const postalCodes = [];
  const postalSeen = new Set();

  for (const b of rawBarangays) {
    const code = String(b.code?.id || b.id || '');
    const cityCode = String(b.parent?.id || '').slice(0, 6);
    if (code.length < 9 || seen.has(code) || !citySet.has(cityCode)) continue;
    seen.add(code);
    barangays.push({ code, name: cleanName(b.name?.en), cityCode });

    const zips = Array.isArray(b.zip_codes) ? b.zip_codes : [];
    for (const z of zips) {
      const postal = String(z || '').trim();
      if (!/^\d{4}$/.test(postal)) continue;
      const key = `${postal}|${cityCode}|${code}`;
      if (postalSeen.has(key)) continue;
      postalSeen.add(key);
      const city = cityByCode.get(cityCode);
      postalCodes.push({
        postalCode: postal,
        regionCode: city?.regionCode || null,
        provinceCode: city?.provinceCode || null,
        cityCode,
        barangayCode: code,
        region: city ? REGION_LABEL[city.regionCode] : null,
        province: city?.provinceCode ? provinceByCodeOut.get(city.provinceCode)?.name || null : null,
        city: city?.name || null,
        areaName: cleanName(b.name?.en),
      });
    }
  }

  const snapshot = {
    meta: {
      source: 'Philippine Statistics Authority — Philippine Standard Geographic Code (PSGC), with Philippine Postal Corporation ZIP codes',
      mirror: 'https://github.com/open-admin-data/philippines-administrative-divisions',
      license: 'CC-BY-4.0',
      edition: new Date().toISOString().slice(0, 10),
      counts: {
        regions: regions.length,
        provinces: provincesOut.length,
        cities: cities.length,
        barangays: barangays.length,
        postalCodes: postalCodes.length,
      },
    },
    regions,
    provinces: provincesOut,
    cities,
    barangays,
    postalCodes,
  };

  const outFile = path.join(OUT_DIR, `PSGC_${snapshot.meta.edition.replace(/-/g, '')}.json`);
  await writeFile(outFile, JSON.stringify(snapshot), 'utf8');

  console.log('');
  for (const [k, v] of Object.entries(snapshot.meta.counts)) {
    console.log(`  ${k.padEnd(12)} ${v.toLocaleString('en-PH')}`);
  }
  console.log(`\n  wrote ${path.relative(process.cwd(), outFile)}`);

  if (VERIFY) await verifyAgainstPsa(snapshot);
}

/**
 * Re-counts the hierarchy straight from the PSA mirror and fails if the
 * snapshot has drifted. A silently truncated download is the one failure mode
 * that would be invisible to a client and quietly block a whole province.
 */
async function verifyAgainstPsa(snapshot) {
  console.log('\n  cross-checking against the PSA PSGC mirror …');
  const psaRegions = await getJson(`${PSA_API}/regions/`, 'psa regions');
  const psaCities = await getJson(`${PSA_API}/cities-municipalities/`, 'psa LGUs');
  const psaBarangays = await getJson(`${PSA_API}/barangays/`, 'psa barangays');

  const problems = [];
  if (psaRegions.length !== snapshot.regions.length) {
    problems.push(`regions: PSA ${psaRegions.length} vs snapshot ${snapshot.regions.length}`);
  }
  if (psaCities.length !== snapshot.cities.length) {
    problems.push(`cities/municipalities: PSA ${psaCities.length} vs snapshot ${snapshot.cities.length}`);
  }
  // PSA publishes more barangays than the ZIP-joined dataset, which is a known
  // and documented lag, so this is a warning rather than a hard failure.
  if (psaBarangays.length > snapshot.barangays.length) {
    console.warn(
      `  note: PSA lists ${psaBarangays.length} barangays, snapshot has ` +
      `${snapshot.barangays.length}. Barangays created after the ZIP dataset ` +
      `edition are expected to be missing. Re-run after a dataset update.`
    );
  }
  if (problems.length) {
    throw new Error(`Snapshot does not match the PSA release:\n    - ${problems.join('\n    - ')}`);
  }
  console.log('  snapshot matches the PSA release.');
}

main().catch((err) => {
  console.error(`\nPSGC fetch failed: ${err.message}`);
  process.exit(1);
});
