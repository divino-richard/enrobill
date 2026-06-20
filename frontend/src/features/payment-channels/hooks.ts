import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchActivePaymentChannels,
  fetchAdminPaymentChannels,
  updatePaymentChannel,
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
