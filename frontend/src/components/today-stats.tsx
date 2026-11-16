import { useEffect, useState } from "react"
import { ArrowDown, ArrowUp, Inbox, Minus } from "lucide-react"
import { listMetrics, type StrategyMetric } from "@/api/metrics"
import { formatPercent, previousTradingDay, todayISO } from "@/lib/date"
import { toastApiError } from "@/lib/notify"
import { EmptyState } from "@/components/empty-state"
import { StatsSkeleton } from "@/components/skeletons"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

type Tone = "up" | "down" | "flat"

function cmp(curr: number, prev: number | null): Tone {
  if (prev === null || curr === prev) return "flat"
  return curr > prev ? "up" : "down"
}

function toneClass(tone: Tone): string {
  if (tone === "up") return "text-red-600 dark:text-red-400"
  if (tone === "down") return "text-green-600 dark:text-green-400"
  return "text-muted-foreground"
}

function Arrow({ tone }: { tone: Tone }) {
  const cls = `size-4 ${toneClass(tone)}`
  if (tone === "up") return <ArrowUp className={cls} aria-label="上升" />
  if (tone === "down") return <ArrowDown className={cls} aria-label="下降" />
  return <Minus className={cls} aria-label="持平" />
}

function StatCell({
  label,
  value,
  prev,
  tone,
}: {
  label: string
  value: string
  prev: number | null
  tone: Tone
}) {
  return (
    <div className="grid min-w-0 gap-1 rounded-lg border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="flex items-center gap-1.5">
        <span className="text-lg font-medium tabular-nums">{value}</span>
        {prev !== null ? <Arrow tone={tone} /> : null}
      </div>
    </div>
  )
}

function jumpToEntry() {
  document.getElementById("metric-entry")?.scrollIntoView({ behavior: "smooth", block: "start" })
}

export function TodayStats({ refreshToken = 0 }: { refreshToken?: number }) {
  const today = todayISO()
  const prevDay = previousTradingDay(today)
  const [todayRow, setTodayRow] = useState<StrategyMetric | null>(null)
  const [prevRow, setPrevRow] = useState<StrategyMetric | null>(null)
  const [loading, setLoading] = useState(true)
  const [reloadTick, setReloadTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    listMetrics({ from: prevDay, to: today, strategy_id: "all" })
      .then((rows) => {
        if (cancelled) return
        setTodayRow(rows.find((r) => r.date === today) ?? null)
        setPrevRow(rows.find((r) => r.date === prevDay) ?? null)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        toastApiError(err, "加载今日指标失败", () => setReloadTick((n) => n + 1))
        setTodayRow(null)
        setPrevRow(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [today, prevDay, refreshToken, reloadTick])

  if (loading) {
    return (
      <Card>
        <CardContent>
          <StatsSkeleton />
        </CardContent>
      </Card>
    )
  }

  if (!todayRow) {
    return (
      <Card>
        <CardContent>
          <EmptyState
            icon={Inbox}
            title="今日暂无数据"
            description="录入今日指标后，这里会显示命中数、涨停数与封板率。"
            action={
              <Button type="button" size="sm" onClick={jumpToEntry}>
                去录入
              </Button>
            }
          />
        </CardContent>
      </Card>
    )
  }

  const prevPicks = prevRow ? prevRow.total_picks : null
  const prevLimit = prevRow ? prevRow.limit_up_count : null
  const prevSeal = prevRow ? prevRow.seal_rate : null
  const prevBreak = prevRow ? prevRow.break_rate : null

  const items = [
    {
      label: "策略命中数",
      value: String(todayRow.total_picks),
      current: todayRow.total_picks,
      prev: prevPicks,
    },
    {
      label: "总涨停数",
      value: String(todayRow.limit_up_count),
      current: todayRow.limit_up_count,
      prev: prevLimit,
    },
    {
      label: "整体封板率",
      value: formatPercent(todayRow.seal_rate),
      current: todayRow.seal_rate,
      prev: prevSeal,
    },
    {
      label: "整体炸板率",
      value: formatPercent(todayRow.break_rate),
      current: todayRow.break_rate,
      prev: prevBreak,
    },
  ]

  return (
    <Card>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {items.map((item) => (
            <StatCell
              key={item.label}
              label={item.label}
              value={item.value}
              prev={item.prev}
              tone={cmp(item.current, item.prev)}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
