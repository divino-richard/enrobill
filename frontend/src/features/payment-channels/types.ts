export interface PaymentChannel {
  id: number;
  code: string;
  label: string;
  accountName: string | null;
  accountNumber: string | null;
  isActive: boolean;
  hasQr: boolean;
  qrUrl: string | null;
}
