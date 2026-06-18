import { useEffect, useState } from "react";

// Returns a debounced copy of `value` that only updates after `delay` ms of no
// changes — handy for search inputs that drive server requests.
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timeout);
  }, [value, delay]);

  return debounced;
}
