import { useNavigate } from "react-router-dom";
import { CalendarOffIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface AdmissionsClosedNoticeProps {
  description?: string;
}

// Shown when an applicant reaches the application form but admissions are
// closed — access is blocked with an explanation instead of the form.
export function AdmissionsClosedNotice({
  description,
}: AdmissionsClosedNoticeProps) {
  const navigate = useNavigate();

  return (
    <Card className="mx-auto max-w-lg">
      <CardContent className="flex flex-col items-center justify-center gap-4 py-14 text-center">
        <div className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-full">
          <CalendarOffIcon className="size-6" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Admissions are closed</h2>
          <p className="text-muted-foreground mx-auto max-w-sm text-sm">
            {description ??
              "Admissions aren't open right now. You can submit an application once admissions reopen."}
          </p>
        </div>
        <Button onClick={() => navigate("/portal/application")}>
          Back to Applications
        </Button>
      </CardContent>
    </Card>
  );
}
