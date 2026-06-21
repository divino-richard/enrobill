import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/features/auth/store";
import { fetchAccount, updatePassword, updateProfile } from "./api";

export const accountQueryKey = ["me", "account"] as const;

export function useAccount() {
  return useQuery({
    queryKey: accountQueryKey,
    queryFn: fetchAccount,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const setUser = useAuthStore((state) => state.setUser);

  return useMutation({
    mutationFn: updateProfile,
    onSuccess: (profile) => {
      queryClient.setQueryData(accountQueryKey, profile);
      // Keep the cached session (sidebar name, etc.) in sync.
      setUser({
        id: profile.id,
        name: profile.name,
        email: profile.email,
        role: profile.role,
      });
    },
  });
}

export function useUpdatePassword() {
  return useMutation({ mutationFn: updatePassword });
}
