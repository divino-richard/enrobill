import { useCallback, useMemo } from "react";
import REGIONS from "@/assets/static/region.json";
import PROVINCES from "@/assets/static/province.json";
import CITIES from "@/assets/static/city.json";
import BARANGAYS from "@/assets/static/barangay.json";

export type Region = {
  id: number;
  psgc_code: string;
  region_name: string;
  region_code: string;
};

export type Province = {
  province_code: string;
  province_name: string;
  psgc_code: string;
  region_code: string;
};

export type City = {
  city_code: string;
  city_name: string;
  province_code: string;
  psgc_code: string;
  region_desc: string;
};

export type Barangay = {
  brgy_code: string;
  brgy_name: string;
  city_code: string;
  province_code: string;
  region_code: string;
};

const regionList = REGIONS as Region[];
const provinceList = PROVINCES as Province[];
const cityList = CITIES as City[];
const barangayList = BARANGAYS as Barangay[];

// Group a list by a parent code, sorting each group by a display name. Built
// once at module load so the (large) barangay list is only indexed a single time.
function groupBy<T>(
  items: T[],
  keyOf: (item: T) => string,
  nameOf: (item: T) => string,
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const group = map.get(key);
    if (group) group.push(item);
    else map.set(key, [item]);
  }
  for (const group of map.values()) {
    group.sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
  }
  return map;
}

const regions = [...regionList].sort((a, b) =>
  a.region_name.localeCompare(b.region_name),
);

const allProvinces = [...provinceList].sort((a, b) =>
  a.province_name.localeCompare(b.province_name),
);

const provincesByRegion = groupBy(
  provinceList,
  (p) => p.region_code,
  (p) => p.province_name,
);
const citiesByProvince = groupBy(
  cityList,
  (c) => c.province_code,
  (c) => c.city_name,
);
const barangaysByCity = groupBy(
  barangayList,
  (b) => b.city_code,
  (b) => b.brgy_name,
);

const regionByCode = new Map(regionList.map((r) => [r.region_code, r]));
const provinceByCode = new Map(provinceList.map((p) => [p.province_code, p]));
const cityByCode = new Map(cityList.map((c) => [c.city_code, c]));
const barangayByCode = new Map(barangayList.map((b) => [b.brgy_code, b]));

interface UseAddressProps {
  regionCode?: string;
  provinceCode?: string;
  cityCode?: string;
}

/**
 * Cascading Philippine address options (region → province → city → barangay).
 *
 * Pass the currently selected codes; each list narrows to the children of its
 * parent. Also exposes name lookups for displaying a selected address.
 */
export const useAddress = ({
  regionCode,
  provinceCode,
  cityCode,
}: UseAddressProps) => {
  // Filtered to the selected region, or all provinces when no region is used
  // (the form is province-first).
  const provinces = useMemo<Province[]>(
    () => (regionCode ? (provincesByRegion.get(regionCode) ?? []) : allProvinces),
    [regionCode],
  );

  const cities = useMemo<City[]>(
    () => (provinceCode ? (citiesByProvince.get(provinceCode) ?? []) : []),
    [provinceCode],
  );

  const barangays = useMemo<Barangay[]>(
    () => (cityCode ? (barangaysByCity.get(cityCode) ?? []) : []),
    [cityCode],
  );

  const getRegionName = useCallback(
    (code: string) => regionByCode.get(code)?.region_name ?? "",
    [],
  );
  const getProvinceName = useCallback(
    (code: string) => provinceByCode.get(code)?.province_name ?? "",
    [],
  );
  const getCityName = useCallback(
    (code: string) => cityByCode.get(code)?.city_name ?? "",
    [],
  );
  const getBarangayName = useCallback(
    (code: string) => barangayByCode.get(code)?.brgy_name ?? "",
    [],
  );

  return {
    regions,
    provinces,
    cities,
    barangays,
    getRegionName,
    getProvinceName,
    getCityName,
    getBarangayName,
  };
};
