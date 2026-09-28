# Philippine geographic reference data

Authoritative hierarchy for the KYC address cascade (§4, §32).

## What is here

| File | Contents |
| --- | --- |
| `PSGC_<YYYYMMDD>.json` | Normalised snapshot consumed by the seed migration and the admin re-import screen. |

Current edition: **PSGC_20260927.json** — 17 regions, 83 provinces, 1,634 cities
and municipalities, 42,036 barangays, and one ZIP mapping per barangay covering
**1,587 distinct ZIP codes** (10.9 MB).

A ZIP code covers a city or municipality, not a barangay, so thousands of
barangays share one. The 42,036 figure is the number of barangay→ZIP *mappings*,
not the number of ZIPs; the mapping is a bijection on barangay code, and
`scripts/psgc/psgcSnapshot.test.ts` asserts both directions.

## Provenance

| Field | Value |
| --- | --- |
| Hierarchy source | Philippine Statistics Authority — Philippine Standard Geographic Code (PSGC) |
| ZIP codes | Philippine Postal Corporation, resolved to barangay level; a ZIP covers a city, so it is shared by many barangays |
| Distribution | [open-admin-data/philippines-administrative-divisions](https://github.com/open-admin-data/philippines-administrative-divisions) |
| Licence | CC-BY-4.0 |
| Cross-check | [psgc.gitlab.io](https://psgc.gitlab.io/api) — read-only PSA mirror |

The snapshot is **committed to the repository**. The running application never
calls an external geography API: a compliance-critical flow must not depend on a
third party being up.

## How it was produced

```bash
node scripts/psgc/fetch-psgc.mjs            # fetch and write a snapshot
node scripts/psgc/fetch-psgc.mjs --verify   # fetch, then cross-check against the PSA mirror
node scripts/psgc/import-psgc.ts            # load a snapshot into the database
```

`--verify` re-counts regions, provinces and LGUs straight from the PSA mirror
and exits non-zero if the snapshot has drifted, so a truncated or stale download
fails at generation time rather than silently blocking a province at runtime.

## Known, documented gaps

- PSA lists 42,046 barangays; the ZIP-joined source carries 42,036. The ten
  barangays created after that source's edition are absent. This is reported by
  `--verify` as a note, not a failure.
- `isCity` / `isCapital` come from the PSA release. If the mirror is
  unreachable at generation time the snapshot falls back to a name heuristic and
  says so in the output.
- NCR has no provinces. The source models it with a placeholder province
  (`130000`, "Metro Manila") whose children are the 17 LGUs of Metro Manila. The
  generator drops the placeholder and marks those LGUs
  `isRegionalDistrict: true` with `provinceCode: null`, which is what makes the
  address form correctly hide the Province field inside NCR (§4).

## Updating

1. `node scripts/psgc/fetch-psgc.mjs --verify`
2. Review the printed counts and the `--verify` note.
3. `node scripts/psgc/import-psgc.ts database/data/psgc/PSGC_<new>.json`

Committed client KYC records store **PSGC codes, not names**, so re-importing a
newer edition never rewrites a client's stored address. Names shown to clients
and staff are resolved at read time from the current tables.

The same import path is exposed to authorised staff at
`POST /api/admin/kyc/psgc/reimport` so boundaries can be refreshed without a
deploy.

## Attribution

When redistributing, retain:

> Philippine Standard Geographic Code (PSGC), Philippine Statistics Authority.
> ZIP codes: Philippine Postal Corporation.
> Aggregated and normalised from Open Admin Data, CC-BY-4.0.
