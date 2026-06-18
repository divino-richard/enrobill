import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  fetchUser,
  fetchUsers,
  updateUserRole,
  type UserListParams,
} from "./api";
import type { UserRole } from "./types";

export const usersQueryKey = ["admin", "users"] as const;

export function useUsers(params: UserListParams) {
  return useQuery({
    queryKey: [...usersQueryKey, "list", params],
    queryFn: () => fetchUsers(params),
    placeholderData: keepPreviousData,
  });
}

export function useUser(id: number) {
  return useQuery({
    queryKey: [...usersQueryKey, "detail", id],
    queryFn: () => fetchUser(id),
  });
}

export function useUpdateUserRole(id: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (role: UserRole) => updateUserRole(id, role),
    onSuccess: (user) => {
      queryClient.invalidateQueries({ queryKey: usersQueryKey });
      queryClient.setQueryData([...usersQueryKey, "detail", id], user);
    },
  });
}
