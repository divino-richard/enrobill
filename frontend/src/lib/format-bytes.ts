// Human-readable file size, e.g. "820 KB" or "2.4 MB".
export function formatBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return mb >= 1
    ? `${mb.toFixed(1)} MB`
    : `${Math.max(Math.round(bytes / 1024), 1)} KB`;
}
