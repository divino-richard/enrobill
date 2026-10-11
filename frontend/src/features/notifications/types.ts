export type NotificationCategory =
  | "billing"
  | "enrollment"
  | "applications"
  | "documents"
  | "transfer"
  | "progression"
  | "account";

export interface StudentNotification {
  id: number;
  category: NotificationCategory;
  title: string;
  message: string;
  ctaLabel: string | null;
  ctaUrl: string | null;
  actionRequired: boolean;
  historical?: boolean;
  unread: boolean;
  createdAt: string;
}
