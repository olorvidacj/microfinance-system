import { psgcService } from '../services/psgcService';
import type { FieldErrors } from '../../shared/kyc-core';

export interface AddressCodes {
  regionCode: string;
  provinceCode: string | null;
  cityCode: string;
  barangayCode: string;
}

export interface ResolvedAddress {
  region: string;
  province: string | null;
  city: string;
  barangay: string;
}

export interface GeoResolver {
  /** `names` is set exactly when `ok` is true. */
  resolve(codes: AddressCodes): { ok: boolean; names: ResolvedAddress | null; errors: FieldErrors };
}

/**
 * Checks that the codes form one consistent PSGC chain (barangay in city, city
 * in province, province in region; NCR-style cities have no province) and
 * returns the official names.
 */
export const psgcResolver: GeoResolver = {
  resolve(codes) {
    const errors: FieldErrors = {};
    const region = psgcService.getRegions().find((r) => r.code === codes.regionCode);
    if (!region) return { ok: false, names: null, errors: { 'address.regionCode': 'Choose a valid region.' } };

    const city = psgcService.getCities(codes.regionCode).find((c) => c.code === codes.cityCode);
    if (!city) return { ok: false, names: null, errors: { 'address.cityCode': 'That city or municipality is not in the selected region.' } };

    const cityProvince = city.provinceCode ?? null;
    if ((codes.provinceCode ?? null) !== cityProvince) {
      errors['address.provinceCode'] = cityProvince
        ? 'That city or municipality belongs to a different province.'
        : 'That city or municipality is not part of a province; leave the province empty.';
    }
    const province = cityProvince ? psgcService.getProvinces(codes.regionCode).find((p) => p.code === cityProvince) : null;

    const barangay = psgcService.getBarangays(codes.cityCode).find((b) => b.code === codes.barangayCode);
    if (!barangay) errors['address.barangayCode'] = 'That barangay is not in the selected city or municipality.';

    if (Object.keys(errors).length > 0) return { ok: false, names: null, errors };
    return { ok: true, errors: {}, names: { region: region.name, province: province?.name ?? null, city: city.name, barangay: barangay!.name } };
  },
};
