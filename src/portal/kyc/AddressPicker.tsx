import React, { useEffect, useState } from 'react';
import type { KycFormState } from '../../../shared/client';
import { profileService } from '../services/profile';
import { SelectField, TextField } from './controls';

/**
 * Region, province, city and barangay from the PSGC lists, then the street
 * line. Choosing a city fills in its ZIP code, which the member can correct.
 */
type Prefix = 'current' | 'perm';
type Place = { code: string; name: string };

export interface AddressPickerProps {
  prefix: Prefix;
  form: KycFormState;
  onChange: (patch: Partial<KycFormState>) => void;
  errors: Partial<Record<keyof KycFormState, string>>;
  disabled?: boolean;
}

const k = <S extends string>(p: Prefix, suffix: S) => `${p}${suffix}` as `${Prefix}${S}` & keyof KycFormState;

function usePlaces(load: (() => Promise<Place[]>) | null, deps: unknown[]): { places: Place[]; failed: boolean } {
  const [places, setPlaces] = useState<Place[]>([]);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    if (!load) {
      setPlaces([]);
      return;
    }
    load().then(
      (list) => !cancelled && setPlaces(list),
      () => !cancelled && (setPlaces([]), setFailed(true)),
    );
    return () => {
      cancelled = true;
    };
    // The loader is rebuilt on every render; deps are its inputs.
  }, deps);
  return { places, failed };
}

export const AddressPicker: React.FC<AddressPickerProps> = ({ prefix, form, onChange, errors, disabled }) => {
  const region = form[k(prefix, 'RegionCode')] as string;
  const province = form[k(prefix, 'ProvinceCode')] as string;
  const city = form[k(prefix, 'CityCode')] as string;

  const regions = usePlaces(() => profileService.getRegions(), []);
  const provinces = usePlaces(region ? () => profileService.getProvinces(region) : null, [region]);
  const cities = usePlaces(region ? () => profileService.getCities(region, province || undefined) : null, [region, province]);
  const barangays = usePlaces(city ? () => profileService.getBarangays(city) : null, [city]);
  const failed = regions.failed || provinces.failed || cities.failed || barangays.failed;

  const nameOf = (list: Place[], code: string) => list.find((p) => p.code === code)?.name ?? '';
  const options = (list: Place[]) => list.map((p) => ({ value: p.code, label: p.name }));

  const chooseCity = (code: string) => {
    onChange({ [k(prefix, 'CityCode')]: code, [k(prefix, 'CityName')]: nameOf(cities.places, code), [k(prefix, 'BarangayCode')]: '', [k(prefix, 'BarangayName')]: '' });
    if (!code) return;
    profileService.getPostalCode(code).then(
      (zip) => zip && onChange({ [k(prefix, 'PostalCode')]: zip }),
      () => undefined, // the member types the ZIP code instead
    );
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {failed && <p className="text-sm text-amber-800 sm:col-span-2">Some address lists could not be loaded. Check your connection and reopen this step.</p>}
      <SelectField
        label="Region"
        required
        disabled={disabled}
        value={region}
        options={options(regions.places)}
        error={errors[k(prefix, 'RegionCode')]}
        onChange={(e) =>
          onChange({
            [k(prefix, 'RegionCode')]: e.target.value,
            [k(prefix, 'RegionName')]: nameOf(regions.places, e.target.value),
            [k(prefix, 'ProvinceCode')]: '',
            [k(prefix, 'ProvinceName')]: '',
            [k(prefix, 'CityCode')]: '',
            [k(prefix, 'CityName')]: '',
            [k(prefix, 'BarangayCode')]: '',
            [k(prefix, 'BarangayName')]: '',
          })
        }
      />
      <SelectField
        label="Province"
        hint={region && provinces.places.length === 0 ? 'This region has no provinces; choose the city directly.' : undefined}
        disabled={disabled || !region || provinces.places.length === 0}
        value={province}
        options={options(provinces.places)}
        onChange={(e) =>
          onChange({
            [k(prefix, 'ProvinceCode')]: e.target.value,
            [k(prefix, 'ProvinceName')]: nameOf(provinces.places, e.target.value),
            [k(prefix, 'CityCode')]: '',
            [k(prefix, 'CityName')]: '',
            [k(prefix, 'BarangayCode')]: '',
            [k(prefix, 'BarangayName')]: '',
          })
        }
      />
      <SelectField
        label="City or municipality"
        required
        disabled={disabled || !region}
        value={city}
        options={options(cities.places)}
        error={errors[k(prefix, 'CityCode')]}
        onChange={(e) => chooseCity(e.target.value)}
      />
      <SelectField
        label="Barangay"
        required
        disabled={disabled || !city}
        value={form[k(prefix, 'BarangayCode')] as string}
        options={options(barangays.places)}
        error={errors[k(prefix, 'BarangayCode')]}
        onChange={(e) => onChange({ [k(prefix, 'BarangayCode')]: e.target.value, [k(prefix, 'BarangayName')]: nameOf(barangays.places, e.target.value) })}
      />
      <TextField
        label="House or unit number"
        disabled={disabled}
        value={form[k(prefix, 'HouseNumber')] as string}
        onChange={(e) => onChange({ [k(prefix, 'HouseNumber')]: e.target.value })}
        autoComplete="address-line1"
      />
      <TextField
        label="Street"
        disabled={disabled}
        value={form[k(prefix, 'Street')] as string}
        error={errors[k(prefix, 'Street')]}
        hint="House number or street is required."
        onChange={(e) => onChange({ [k(prefix, 'Street')]: e.target.value })}
        autoComplete="address-line2"
      />
      <TextField
        label="Subdivision or village"
        disabled={disabled}
        value={form[k(prefix, 'Subdivision')] as string}
        onChange={(e) => onChange({ [k(prefix, 'Subdivision')]: e.target.value })}
      />
      <TextField
        label="ZIP code"
        required
        inputMode="numeric"
        maxLength={4}
        disabled={disabled}
        value={form[k(prefix, 'PostalCode')] as string}
        error={errors[k(prefix, 'PostalCode')]}
        onChange={(e) => onChange({ [k(prefix, 'PostalCode')]: e.target.value.replace(/\D/g, '') })}
        autoComplete="postal-code"
      />
      <TextField
        label="Landmark"
        className="sm:col-span-2"
        disabled={disabled}
        value={form[k(prefix, 'Landmark')] as string}
        onChange={(e) => onChange({ [k(prefix, 'Landmark')]: e.target.value })}
        placeholder="Near the chapel, beside the school…"
      />
    </div>
  );
};
