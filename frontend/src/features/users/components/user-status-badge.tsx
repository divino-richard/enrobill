import { Badge } from "@/components/ui/badge";

export function UserStatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <Badge variant={isActive ? "outline" : "destructive"}>
      {isActive ? "Active" : "Inactive"}
    </Badge>
  );
}
