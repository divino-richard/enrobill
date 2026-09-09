import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const HOURS = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, "0"));

type TimePickerProps = {
  id: string;
  label: string;
  /** A 24-hour HH:mm value, matching the scheduling API. */
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
};

export function TimePicker({ id, label, value, onValueChange, disabled }: TimePickerProps) {
  const [hours, minutes] = value.split(":");
  const hour24 = Number(hours);
  const hour12 = String(hour24 % 12 || 12).padStart(2, "0");
  const period = hour24 >= 12 ? "PM" : "AM";

  function update(hour: string, minute: string, nextPeriod: string) {
    const nextHour = Number(hour) % 12 + (nextPeriod === "PM" ? 12 : 0);
    onValueChange(`${String(nextHour).padStart(2, "0")}:${minute}`);
  }

  return (
    <div role="group" aria-label={label} className="flex min-w-0 items-center gap-1.5">
      <Select value={hour12} disabled={disabled} onValueChange={(hour) => update(hour, minutes, period)}>
        <SelectTrigger id={id} aria-label={`${label}, hour`} className="min-w-0 flex-1 tabular-nums">
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper" className="max-h-60 min-w-20">
          {HOURS.map((hour) => <SelectItem key={hour} value={hour}>{hour}</SelectItem>)}
        </SelectContent>
      </Select>
      <span aria-hidden="true" className="text-muted-foreground">:</span>
      <Select value={minutes} disabled={disabled} onValueChange={(minute) => update(hour12, minute, period)}>
        <SelectTrigger aria-label={`${label}, minute`} className="min-w-0 flex-1 tabular-nums">
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper" className="max-h-60 min-w-20">
          {MINUTES.map((minute) => <SelectItem key={minute} value={minute}>{minute}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={period} disabled={disabled} onValueChange={(nextPeriod) => update(hour12, minutes, nextPeriod)}>
        <SelectTrigger aria-label={`${label}, AM or PM`} className="shrink-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper" className="min-w-20">
          <SelectItem value="AM">AM</SelectItem>
          <SelectItem value="PM">PM</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
