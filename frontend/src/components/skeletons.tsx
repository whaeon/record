import { Skeleton } from "@/components/ui/skeleton"

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="grid gap-3">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-lg" />
      ))}
    </div>
  )
}

export function ChartSkeleton() {
  return <Skeleton className="h-[280px] w-full rounded-xl md:h-[360px]" />
}

export function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="h-20 rounded-lg" />
      ))}
    </div>
  )
}

export function EditorSkeleton() {
  return <Skeleton className="h-[min(60vh,28rem)] w-full rounded-lg md:h-[480px]" />
}
