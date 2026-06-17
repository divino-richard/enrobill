interface StepPlaceholderProps {
  title: string
}

// Temporary content for steps whose fields aren't built yet.
export function StepPlaceholder({ title }: StepPlaceholderProps) {
  return (
    <div className="rounded-lg border border-dashed p-10 text-center">
      <p className="font-medium">{title}</p>
      <p className="text-muted-foreground mt-1 text-sm">
        This section will be added soon.
      </p>
    </div>
  )
}
