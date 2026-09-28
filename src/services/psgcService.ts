import fs from 'fs';
import path from 'path';

export interface PsgcRegion {
  code: string;
  name: string;
  longName?: string;
  sortOrder: number;
}

export interface PsgcProvince {
  code: string;
  name: string;
  longName?: string;
  regionCode: string;
}

export interface PsgcCity {
  code: string;
  name: string;
  longName?: string;
  shortName?: string;
  provinceCode?: string | null;
  regionCode: string;
  isRegionalDistrict?: boolean;
  isCity?: boolean;
  isCapital?: boolean;
}

export interface PsgcBarangay {
  code: string;
  name: string;
  cityCode: string;
}

export interface PsgcPostalCode {
  postalCode: string;
  regionCode?: string;
  provinceCode?: string | null;
  cityCode?: string;
  barangayCode?: string;
  region?: string;
  province?: string;
  city?: string;
  areaName?: string;
}

interface PsgcData {
  regions: PsgcRegion[];
  provinces: PsgcProvince[];
  cities: PsgcCity[];
  barangays: PsgcBarangay[];
  postalCodes: PsgcPostalCode[];
}

let cachedData: PsgcData | null = null;
let provincesByRegion: Map<string, PsgcProvince[]> = new Map();
let citiesByRegion: Map<string, PsgcCity[]> = new Map();
let citiesByProvince: Map<string, PsgcCity[]> = new Map();
let barangaysByCity: Map<string, PsgcBarangay[]> = new Map();
let postalByCity: Map<string, string> = new Map();
let postalByBarangay: Map<string, string> = new Map();

function ensureLoaded(): PsgcData {
  if (cachedData) return cachedData;

  const dataPath = path.resolve(process.cwd(), 'database/data/psgc/PSGC_20260927.json');
  if (!fs.existsSync(dataPath)) {
    console.warn(`[PSGC] File not found at ${dataPath}`);
    return {
      regions: [],
      provinces: [],
      cities: [],
      barangays: [],
      postalCodes: [],
    };
  }

  const raw = fs.readFileSync(dataPath, 'utf8');
  const parsed: PsgcData = JSON.parse(raw);
  cachedData = parsed;

  // Build indexes for instant lookups
  provincesByRegion.clear();
  for (const prov of parsed.provinces || []) {
    const list = provincesByRegion.get(prov.regionCode) || [];
    list.push(prov);
    provincesByRegion.set(prov.regionCode, list);
  }

  citiesByRegion.clear();
  citiesByProvince.clear();
  for (const city of parsed.cities || []) {
    const regList = citiesByRegion.get(city.regionCode) || [];
    regList.push(city);
    citiesByRegion.set(city.regionCode, regList);

    if (city.provinceCode) {
      const provList = citiesByProvince.get(city.provinceCode) || [];
      provList.push(city);
      citiesByProvince.set(city.provinceCode, provList);
    }
  }

  barangaysByCity.clear();
  for (const bgy of parsed.barangays || []) {
    const list = barangaysByCity.get(bgy.cityCode) || [];
    list.push(bgy);
    barangaysByCity.set(bgy.cityCode, list);
  }

  postalByCity.clear();
  postalByBarangay.clear();
  for (const p of parsed.postalCodes || []) {
    if (p.cityCode && !postalByCity.has(p.cityCode)) {
      postalByCity.set(p.cityCode, p.postalCode);
    }
    if (p.barangayCode) {
      postalByBarangay.set(p.barangayCode, p.postalCode);
    }
  }

  return cachedData;
}

export const psgcService = {
  getRegions(): PsgcRegion[] {
    const data = ensureLoaded();
    return (data.regions || []).slice().sort((a, b) => a.sortOrder - b.sortOrder);
  },

  getProvinces(regionCode?: string): PsgcProvince[] {
    ensureLoaded();
    if (!regionCode) return cachedData?.provinces || [];
    return (provincesByRegion.get(regionCode) || []).slice().sort((a, b) => a.name.localeCompare(b.name));
  },

  getCities(regionCode?: string, provinceCode?: string): PsgcCity[] {
    ensureLoaded();
    if (provinceCode) {
      return (citiesByProvince.get(provinceCode) || []).slice().sort((a, b) => a.name.localeCompare(b.name));
    }
    if (regionCode) {
      return (citiesByRegion.get(regionCode) || []).slice().sort((a, b) => a.name.localeCompare(b.name));
    }
    return (cachedData?.cities || []).slice().sort((a, b) => a.name.localeCompare(b.name));
  },

  getBarangays(cityCode: string): PsgcBarangay[] {
    ensureLoaded();
    if (!cityCode) return [];
    return (barangaysByCity.get(cityCode) || []).slice().sort((a, b) => a.name.localeCompare(b.name));
  },

  getPostalCode(cityCode?: string, barangayCode?: string): string {
    ensureLoaded();
    if (barangayCode && postalByBarangay.has(barangayCode)) {
      return postalByBarangay.get(barangayCode)!;
    }
    if (cityCode && postalByCity.has(cityCode)) {
      return postalByCity.get(cityCode)!;
    }
    return '';
  },

  formatAddress(addr: {
    houseNumber?: string;
    street?: string;
    subdivision?: string;
    barangay?: string;
    city?: string;
    province?: string;
    region?: string;
    postalCode?: string;
  }): string {
    const parts = [
      addr.houseNumber,
      addr.street,
      addr.subdivision,
      addr.barangay ? `Brgy. ${addr.barangay}` : null,
      addr.city,
      addr.province,
      addr.postalCode,
    ].filter(Boolean);
    return parts.join(', ');
  },
};
