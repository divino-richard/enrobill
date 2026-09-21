/** Keep list labels concise while retaining the configured name for inspection. */
export function CompactProgramLabel({ label }: { label: string }) {
  const shortLabel = label.replace(/\s*\([^)]*\)/g, "").trim() || label;
  return <span className="font-medium whitespace-nowrap" title={label} aria-label={label}>{shortLabel}</span>;
}
