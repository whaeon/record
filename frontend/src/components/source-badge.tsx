export function SourceBadge({ source }: { source?: string }) {
  if (source !== "auto") return null
  return (
    <span
      className="inline-flex size-3.5 shrink-0 items-center justify-center rounded-full bg-muted text-[9px] font-medium leading-none text-muted-foreground"
      title="自动计算"
    >
      A
    </span>
  )
}

export function SourceHint({ source }: { source?: string }) {
  if (source !== "auto") return null
  return <span className="text-[10px] text-muted-foreground">自动计算</span>
}
