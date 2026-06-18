import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

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

// The address datasets live in /public/static and are fetched at runtime rather
// than imported, so the large city/barangay files (barangay.json is ~4.7 MB)
// stay out of the JS bundle and only load when the form actually needs them.
async function fetchAddressJson<T>(file: string): Promise<T> {
  const res = await fetch(`${import.meta.env.BASE_URL}static/${file}`);
  if (!res.ok) {
    throw new Error(`Failed to load ${file} (${res.status})`);
  }
  return (await res.json()) as T;
}

// Group a list by a parent code, sorting each group by a display name.
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

// Datasets never change within a session, so cache them forever.
const ADDRESS_QUERY = {
  staleTime: Infinity,
  gcTime: Infinity,
} as const;

interface UseAddressProps {
  provinceCode?: string;
  cityCode?: string;
}

/**
 * Cascading Philippine address options (province → city → barangay).
 *
 * Province data loads as soon as the hook mounts; the larger city and barangay
 * datasets are fetched lazily only once their parent is selected. Pass the
 * currently selected codes to narrow each list and to resolve display names.
 */
export const useAddress = ({ provinceCode, cityCode }: UseAddressProps) => {
  const provinceQuery = useQuery({
    queryKey: ["address", "provinces"],
    queryFn: () => fetchAddressJson<Province[]>("province.json"),
    ...ADDRESS_QUERY,
  });

  const cityQuery = useQuery({
    queryKey: ["address", "cities"],
    queryFn: () => fetchAddressJson<City[]>("city.json"),
    enabled: Boolean(provinceCode),
    ...ADDRESS_QUERY,
  });

  const barangayQuery = useQuery({
    queryKey: ["address", "barangays"],
    queryFn: () => fetchAddressJson<Barangay[]>("barangay.json"),
    enabled: Boolean(cityCode),
    ...ADDRESS_QUERY,
  });

  const provinceData = useMemo(
    () => provinceQuery.data ?? [],
    [provinceQuery.data],
  );
  const cityData = useMemo(() => cityQuery.data ?? [], [cityQuery.data]);
  const barangayData = useMemo(
    () => barangayQuery.data ?? [],
    [barangayQuery.data],
  );

  const provinces = useMemo<Province[]>(() => {
    // The source data has a few duplicate province codes (e.g. NCR Manila
    // appears twice). Dedupe by code — keeping the last entry so the list
    // matches the `provinceByCode` lookup below — to avoid duplicate React
    // keys and an ambiguous selection.
    const byCode = new Map(provinceData.map((p) => [p.province_code, p]));
    return [...byCode.values()].sort((a, b) =>
      a.province_name.localeCompare(b.province_name),
    );
  }, [provinceData]);

  const citiesByProvince = useMemo(
    () =>
      groupBy(
        cityData,
        (c) => c.province_code,
        (c) => c.city_name,
      ),
    [cityData],
  );
  const cities = useMemo<City[]>(
    () => (provinceCode ? (citiesByProvince.get(provinceCode) ?? []) : []),
    [provinceCode, citiesByProvince],
  );

  const barangaysByCity = useMemo(
    () =>
      groupBy(
        barangayData,
        (b) => b.city_code,
        (b) => b.brgy_name,
      ),
    [barangayData],
  );
  const barangays = useMemo<Barangay[]>(
    () => (cityCode ? (barangaysByCity.get(cityCode) ?? []) : []),
    [cityCode, barangaysByCity],
  );

  const provinceByCode = useMemo(
    () => new Map(provinceData.map((p) => [p.province_code, p])),
    [provinceData],
  );
  const cityByCode = useMemo(
    () => new Map(cityData.map((c) => [c.city_code, c])),
    [cityData],
  );
  const barangayByCode = useMemo(
    () => new Map(barangayData.map((b) => [b.brgy_code, b])),
    [barangayData],
  );

  const getProvinceName = useCallback(
    (code: string) => provinceByCode.get(code)?.province_name ?? "",
    [provinceByCode],
  );
  const getCityName = useCallback(
    (code: string) => cityByCode.get(code)?.city_name ?? "",
    [cityByCode],
  );
  const getBarangayName = useCallback(
    (code: string) => barangayByCode.get(code)?.brgy_name ?? "",
    [barangayByCode],
  );

  return {
    provinces,
    cities,
    barangays,
    // First-load flags so the comboboxes can show a loading placeholder.
    provincesLoading: provinceQuery.isLoading,
    citiesLoading: cityQuery.isLoading,
    barangaysLoading: barangayQuery.isLoading,
    getProvinceName,
    getCityName,
    getBarangayName,
  };
};
