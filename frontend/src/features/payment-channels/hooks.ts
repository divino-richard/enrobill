import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createPaymentChannel,
  deletePaymentChannel,
  fetchActivePaymentChannels,
  fetchAdminPaymentChannels,
  updatePaymentChannel,
  type PaymentChannelCreateInput,
  type PaymentChannelInput,
} from "./api";

export const adminPaymentChannelsKey = ["admin", "payment-channels"] as const;
export const activePaymentChannelsKey = ["payment-channels"] as const;

export function useAdminPaymentChannels() {
  return useQuery({
    queryKey: adminPaymentChannelsKey,
    queryFn: fetchAdminPaymentChannels,
  });
}

export function useActivePaymentChannels() {
  return useQuery({
    queryKey: activePaymentChannelsKey,
    queryFn: fetchActivePaymentChannels,
  });
}

export function useCreatePaymentChannel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PaymentChannelCreateInput) =>
      createPaymentChannel(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminPaymentChannelsKey });
      queryClient.invalidateQueries({ queryKey: activePaymentChannelsKey });
    },
  });
}

export function useDeletePaymentChannel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deletePaymentChannel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminPaymentChannelsKey });
      queryClient.invalidateQueries({ queryKey: activePaymentChannelsKey });
    },
  });
}

export function useUpdatePaymentChannel(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PaymentChannelInput) => updatePaymentChannel(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminPaymentChannelsKey });
      queryClient.invalidateQueries({ queryKey: activePaymentChannelsKey });
    },
  });
}
