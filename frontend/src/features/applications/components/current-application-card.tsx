import {
  ArrowRightIcon,
  CalendarDaysIcon,
  ClockIcon,
  HashIcon,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ApplicationStatusBadge } from "./application-status-badge";
import { APPLICATION_STATUS_META, type Application } from "../types";
import { formatDate } from "../utils";

function Field({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="space-y-1">
      <dt className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <Icon className="size-3.5" />
        {label}
      </dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  );
}

interface CurrentApplicationCardProps {
  application: Application;
}

export function CurrentApplicationCard({
  application,
}: CurrentApplicationCardProps) {
  const meta = APPLICATION_STATUS_META[application.status];
  const needsAction =
    application.status === "draft" || application.status === "returned";

  return (
    <Card className="border-l-primary border-l-4">
      <CardHeader>
        <CardDescription className="text-xs font-medium tracking-wide uppercase">
          Current application
        </CardDescription>
        <CardTitle className="text-lg">{application.program}</CardTitle>
        <CardAction>
          <ApplicationStatusBadge status={application.status} />
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-5">
        <p className="text-muted-foreground text-sm">{meta.description}</p>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3">
          <Field
            icon={HashIcon}
            label="Reference"
            value={application.reference}
          />
          <Field
            icon={CalendarDaysIcon}
            label="School Year"
            value={`${application.schoolYear} · ${application.semester}`}
          />
          <Field
            icon={ClockIcon}
            label="Last updated"
            value={formatDate(application.updatedAt)}
          />
        </dl>

        <div className="flex justify-end">
          <Button variant={needsAction ? "default" : "outline"}>
            {needsAction ? "Continue application" : "View details"}
            <ArrowRightIcon />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
