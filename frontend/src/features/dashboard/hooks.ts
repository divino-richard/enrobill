import { useQuery } from "@tanstack/react-query";
import { fetchStaffDashboard } from "./api";

export const staffDashboardQueryKey = ["admin", "dashboard"] as const;

export function useStaffDashboard() {
  return useQuery({
    queryKey: staffDashboardQueryKey,
    queryFn: fetchStaffDashboard,
  });
}
