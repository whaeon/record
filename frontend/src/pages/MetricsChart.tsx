import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { useMediaQuery } from "@/hooks/use-media-query"
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts"
import { ChevronsUpDown, Expand, LineChart as LineChartIcon } from "lucide-react"
import { listMetricDates, listMetrics, type StrategyMetric } from "@/api/metrics"
import { listNotes } from "@/api/notes"
import { listStrategies, type Strategy } from "@/api/strategies"
import { DatePicker } from "@/components/date-picker"
import { EmptyState } from "@/components/empty-state"
import { MetricsEntryDialog } from "@/components/metrics-entry-dialog"
import { ChartSkeleton } from "@/components/skeletons"
import { SourceBadge, SourceHint } from "@/components/source-badge"
import { StrategyManageDialog } from "@/components/strategy-manage-dialog"
import { TodayStats } from "@/components/today-stats"
import {
  lastNTradingDays,
  matchRangePreset,
  thisMonthTradingRange,
  todayISO,
  type RangePreset,
} from "@/lib/date"
import {
  notesPath,
  parseDateParam,
  parseStrategyParam,
  type StrategyFilter,
} from "@/lib/nav"
import { toastApiError } from "@/lib/notify"
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

const METRIC_OPTIONS = [
  { key: "total_picks", label: "筛出票数", color: "var(--chart-1)", kind: "count" },
  { key: "limit_up_count", label: "涨停数", color: "var(--chart-2)", kind: "count" },
  { key: "failed_limit_count", label: "炸板数", color: "var(--chart-3)", kind: "count" },
  { key: "seal_rate", label: "封板率", color: "var(--chart-4)", kind: "rate" },
  { key: "break_rate", label: "炸板率", color: "var(--chart-5)", kind: "rate" },
] as const

type MetricKey = (typeof METRIC_OPTIONS)[number]["key"]

const chartConfig = {
  total_picks: { label: "筛出票数", color: "var(--chart-1)" },
  limit_up_count: { label: "涨停数", color: "var(--chart-2)" },
  failed_limit_count: { label: "炸板数", color: "var(--chart-3)" },
  seal_rate: { label: "封板率", color: "var(--chart-4)" },
  break_rate: { label: "炸板率", color: "var(--chart-5)" },
} satisfies ChartConfig

const SEAL_THRESHOLD_KEY = "chart.sealRateThreshold"
const DEFAULT_SEAL_THRESHOLD = 60
const METRICS_KEY = "chart.selectedMetrics"

function clampThreshold(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_SEAL_THRESHOLD
  return Math.min(100, Math.max(0, Math.round(n)))
}

function loadSealThreshold(): number {
  try {
    const raw = localStorage.getItem(SEAL_THRESHOLD_KEY)
    if (raw == null) return DEFAULT_SEAL_THRESHOLD
    return clampThreshold(Number(raw))
  } catch {
    return DEFAULT_SEAL_THRESHOLD
  }
}

function saveSealThreshold(n: number) {
  try {
    localStorage.setItem(SEAL_THRESHOLD_KEY, String(n))
  } catch {
    return
  }
}

function loadSelectedMetrics(): MetricKey[] {
  try {
    const raw = localStorage.getItem(METRICS_KEY)
    if (!raw) return ["seal_rate"]
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return ["seal_rate"]
    const keys = parsed.filter((k): k is MetricKey =>
      METRIC_OPTIONS.some((m) => m.key === k)
    )
    return keys.length > 0 ? keys : ["seal_rate"]
  } catch {
    return ["seal_rate"]
  }
}

function saveSelectedMetrics(keys: MetricKey[]) {
  try {
    localStorage.setItem(METRICS_KEY, JSON.stringify(keys))
  } catch {
    return
  }
}

function compactDateLabel(iso: string, peer: string): string {
  if (!iso) return "日期"
  if (iso.slice(0, 4) !== peer.slice(0, 4)) return iso
  return iso.slice(5)
}

type ChartRow = {
  date: string
  source?: string
  total_picks: number
  limit_up_count: number
  failed_limit_count: number
  seal_rate: number
  break_rate: number
}

export default function MetricsChart() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const defaultRange = lastNTradingDays(20)
  const from = parseDateParam(searchParams.get("from")) ?? defaultRange.from
  const to = parseDateParam(searchParams.get("to")) ?? defaultRange.to
  const urlStrategy = parseStrategyParam(searchParams.get("strategy_id"))
  const initialUrlStrategy = useRef(urlStrategy)
  const focusDate = parseDateParam(searchParams.get("date"))
  const [strategies, setStrategies] = useState<Strategy[]>([])
  const [rows, setRows] = useState<StrategyMetric[]>([])
  const [loading, setLoading] = useState(false)
  const [existingDates, setExistingDates] = useState<string[]>([])
  const [noteDates, setNoteDates] = useState<Set<string>>(new Set())
  const [pendingDate, setPendingDate] = useState<string | null>(null)
  const [reloadTick, setReloadTick] = useState(0)
  const [sealThreshold, setSealThreshold] = useState(loadSealThreshold)
  const [thresholdDraft, setThresholdDraft] = useState(String(loadSealThreshold()))
  const isMobile = useMediaQuery("(max-width: 767px)")
  const [entryOpen, setEntryOpen] = useState(false)
  const [entryDate, setEntryDate] = useState(todayISO())
  const [manageOpen, setManageOpen] = useState(false)
  const [statsTick, setStatsTick] = useState(0)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [selectedMetrics, setSelectedMetrics] = useState<MetricKey[]>(loadSelectedMetrics)
  const [strategyPickerOpen, setStrategyPickerOpen] = useState(false)
  const [metricPickerOpen, setMetricPickerOpen] = useState(false)
  const [overviewOpen, setOverviewOpen] = useState(false)

  function openEntry(date?: string) {
    setEntryDate(date ?? focusDate ?? todayISO())
    setEntryOpen(true)
  }

  function onMetricsSaved() {
    setStatsTick((n) => n + 1)
    setReloadTick((n) => n + 1)
    listMetricDates()
      .then(setExistingDates)
      .catch(() => {})
  }

  function applySealThreshold(raw: string) {
    const next = clampThreshold(Number(raw))
    setSealThreshold(next)
    setThresholdDraft(String(next))
    saveSealThreshold(next)
  }

  const activePreset = matchRangePreset(from, to, existingDates)

  function applyPreset(preset: RangePreset) {
    if (preset === "5") {
      const r = lastNTradingDays(5)
      patchParams({ from: r.from, to: r.to })
      return
    }
    if (preset === "20") {
      const r = lastNTradingDays(20)
      patchParams({ from: r.from, to: r.to })
      return
    }
    if (preset === "month") {
      const r = thisMonthTradingRange()
      patchParams({ from: r.from, to: r.to })
      return
    }
    if (existingDates.length > 0) {
      patchParams({ from: existingDates[0], to: existingDates[existingDates.length - 1] })
      return
    }
    const r = lastNTradingDays(20)
    patchParams({ from: r.from, to: r.to })
  }

  function notesStrategy(ids = selectedIds): StrategyFilter {
    return ids.length === 1 ? ids[0] : "all"
  }

  function patchParams(next: { from?: string; to?: string; date?: string | null; strategy_id?: StrategyFilter }) {
    const q = new URLSearchParams()
    q.set("from", next.from ?? from)
    q.set("to", next.to ?? to)
    const sid = next.strategy_id ?? notesStrategy()
    q.set("strategy_id", sid === "all" ? "all" : String(sid))
    const d = next.date === undefined ? focusDate : next.date
    if (d) q.set("date", d)
    setSearchParams(q, { replace: true })
  }

  useEffect(() => {
    listStrategies()
      .then((list) => {
        setStrategies(list)
        const initial = initialUrlStrategy.current
        if (typeof initial === "number") {
          setSelectedIds(list.some((s) => s.id === initial) ? [initial] : [])
        } else {
          setSelectedIds(list.filter((s) => s.is_active).map((s) => s.id))
        }
      })
      .catch(() => {})
    listMetricDates()
      .then(setExistingDates)
      .catch(() => {})
    listNotes()
      .then((list) => setNoteDates(new Set(list.filter((n) => n.content.trim()).map((n) => n.date))))
      .catch(() => {})
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    listMetrics({ from, to })
      .then((list) => {
        if (!cancelled) setRows(list)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          toastApiError(err, "查询失败", () => setReloadTick((n) => n + 1))
          setRows([])
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [from, to, reloadTick])

  const groups = useMemo(() => {
    return selectedIds
      .map((id) => {
        const strategy = strategies.find((s) => s.id === id)
        const data: ChartRow[] = rows
          .filter((r) => r.strategy_id === id)
          .map((r) => ({
            date: r.date,
            source: r.source,
            total_picks: r.total_picks,
            limit_up_count: r.limit_up_count,
            failed_limit_count: r.failed_limit_count,
            seal_rate: r.seal_rate * 100,
            break_rate: r.break_rate * 100,
          }))
        return strategy ? { strategy, data } : null
      })
      .filter((g): g is { strategy: Strategy; data: ChartRow[] } => g !== null)
  }, [selectedIds, strategies, rows])

  const visibleGroups = groups.filter((g) => g.data.length > 0)
  const metricDefs = METRIC_OPTIONS.filter((m) => selectedMetrics.includes(m.key))

  function goToNote(date: string) {
    if (noteDates.has(date)) {
      navigate(notesPath({ date, from, to, strategy_id: notesStrategy() }))
      return
    }
    setPendingDate(date)
  }

  function onChartClick(state: unknown) {
    if (!state || typeof state !== "object") return
    const payload = (state as { activePayload?: { payload?: { date?: string } }[] }).activePayload
    const date = payload?.[0]?.payload?.date
    if (date) goToNote(date)
  }

  function toggleStrategy(id: number) {
    setSelectedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      const ordered = strategies.filter((s) => next.includes(s.id)).map((s) => s.id)
      patchParams({ strategy_id: notesStrategy(ordered) })
      return ordered
    })
  }

  function toggleMetric(key: MetricKey) {
    setSelectedMetrics((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
      const ordered = METRIC_OPTIONS.filter((m) => next.includes(m.key)).map((m) => m.key)
      saveSelectedMetrics(ordered)
      return ordered
    })
  }

  const strategyLabel =
    selectedIds.length === 0
      ? "选择策略"
      : selectedIds.length === strategies.length && strategies.length > 0
        ? "全部策略"
        : selectedIds.length === 1
          ? (strategies.find((s) => s.id === selectedIds[0])?.name ?? "1 个策略")
          : `${selectedIds.length} 个策略`

  const metricLabel =
    selectedMetrics.length === 0
      ? "选择指标"
      : selectedMetrics.length === 1
        ? (METRIC_OPTIONS.find((m) => m.key === selectedMetrics[0])?.label ?? "1 项指标")
        : `${selectedMetrics.length} 项指标`

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="shrink-0">
        <TodayStats refreshToken={statsTick} onEntryClick={() => openEntry()} />
      </div>
      <Card size="sm" className="shrink-0">
        <CardContent className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            {(
              [
                ["5", "近 5 日"],
                ["20", "近 20 日"],
                ["month", "本月"],
                ["all", "全部"],
              ] as const
            ).map(([key, label]) => (
              <Button
                key={key}
                type="button"
                variant={activePreset === key ? "default" : "outline"}
                size="sm"
                onClick={() => applyPreset(key)}
              >
                {label}
              </Button>
            ))}
          </div>
          <div
            className="inline-flex h-7 max-md:h-11 shrink-0 items-center rounded-lg border border-border bg-background px-0.5 dark:border-input dark:bg-input/30"
            role="group"
            aria-label="日期范围"
          >
            <DatePicker
              id="from"
              mode="filter"
              compact
              value={from}
              dates={existingDates}
              displayValue={compactDateLabel(from, to)}
              onChange={(v) => patchParams({ from: v })}
            />
            <span className="px-0.5 text-xs text-muted-foreground" aria-hidden>
              –
            </span>
            <DatePicker
              id="to"
              mode="filter"
              compact
              value={to}
              dates={existingDates}
              displayValue={compactDateLabel(to, from)}
              onChange={(v) => patchParams({ to: v })}
            />
          </div>
          <Popover open={strategyPickerOpen} onOpenChange={setStrategyPickerOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                role="combobox"
                aria-expanded={strategyPickerOpen}
                className="max-w-40 justify-between font-normal"
              >
                <span className="truncate">{strategyLabel}</span>
                <ChevronsUpDown className="size-4 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-56 p-0">
              <Command>
                <CommandInput placeholder="搜索交易策略" />
                <CommandList>
                  <CommandEmpty>未找到交易策略</CommandEmpty>
                  <CommandGroup>
                    {strategies.map((s) => (
                      <CommandItem
                        key={s.id}
                        value={s.name}
                        data-checked={selectedIds.includes(s.id) || undefined}
                        onSelect={() => toggleStrategy(s.id)}
                      >
                        {s.is_active ? s.name : `${s.name}（已停用）`}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          <Popover open={metricPickerOpen} onOpenChange={setMetricPickerOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                role="combobox"
                aria-expanded={metricPickerOpen}
                className="max-w-36 justify-between font-normal"
              >
                <span className="truncate">{metricLabel}</span>
                <ChevronsUpDown className="size-4 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-44 p-0">
              <Command>
                <CommandList>
                  <CommandGroup>
                    {METRIC_OPTIONS.map((m) => (
                      <CommandItem
                        key={m.key}
                        value={m.label}
                        data-checked={selectedMetrics.includes(m.key) || undefined}
                        onSelect={() => toggleMetric(m.key)}
                      >
                        {m.label}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          <div className="flex items-center gap-1.5">
            <Label htmlFor="seal-threshold" className="whitespace-nowrap text-xs text-muted-foreground">
              封板率阈值
            </Label>
            <Input
              id="seal-threshold"
              type="number"
              min={0}
              max={100}
              step={1}
              inputMode="numeric"
              className="h-8 w-14"
              value={thresholdDraft}
              onChange={(e) => setThresholdDraft(e.target.value)}
              onBlur={() => applySealThreshold(thresholdDraft)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.currentTarget.blur()
                }
              }}
              aria-label="封板率阈值百分比"
            />
            <span className="text-xs text-muted-foreground">%</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={visibleGroups.length === 0 || metricDefs.length === 0}
              onClick={() => setOverviewOpen(true)}
            >
              <Expand className="size-4" />
              全览
            </Button>
            <Button type="button" size="sm" onClick={() => openEntry()}>
              录入
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setManageOpen(true)}>
              管理交易策略
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card size="sm" className="flex min-h-0 flex-1 flex-col">
        <CardContent className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
          {loading ? (
            <ChartSkeleton />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={LineChartIcon}
              title="暂无指标数据"
              description="请先录入每日指标，再查看走势。"
              action={
                <Button type="button" onClick={() => openEntry()}>
                  去录入
                </Button>
              }
            />
          ) : selectedIds.length === 0 || metricDefs.length === 0 ? (
            <EmptyState
              icon={LineChartIcon}
              title="请勾选策略和指标"
              description="至少选择一个交易策略和一项指标后才会绘图。"
            />
          ) : visibleGroups.length === 0 ? (
            <EmptyState
              icon={LineChartIcon}
              title="所选策略暂无数据"
              description="换个日期范围，或勾选其他交易策略。"
            />
          ) : (
            <ChartGrid
              groups={visibleGroups}
              metrics={metricDefs}
              sealThreshold={sealThreshold}
              isMobile={isMobile}
              focusDate={focusDate}
              onChartClick={onChartClick}
            />
          )}
        </CardContent>
      </Card>

      <Dialog open={overviewOpen} onOpenChange={setOverviewOpen}>
        <DialogContent className="flex h-[min(92vh,56rem)] w-[min(96vw,80rem)] max-w-none flex-col overflow-hidden sm:max-w-none">
          <DialogHeader>
            <DialogTitle>图表全览</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-auto pr-1">
            <ChartGrid
              groups={visibleGroups}
              metrics={metricDefs}
              sealThreshold={sealThreshold}
              isMobile={isMobile}
              focusDate={focusDate}
              onChartClick={onChartClick}
              tall
            />
          </div>
        </DialogContent>
      </Dialog>

      <MetricsEntryDialog
        open={entryOpen}
        onOpenChange={setEntryOpen}
        date={entryDate}
        onSaved={onMetricsSaved}
        onNeedStrategies={() => setManageOpen(true)}
      />
      <StrategyManageDialog
        open={manageOpen}
        onOpenChange={setManageOpen}
        onChanged={() => {
          listStrategies()
            .then((list) => {
              setStrategies(list)
              setSelectedIds((prev) => prev.filter((id) => list.some((s) => s.id === id)))
            })
            .catch(() => {})
          setReloadTick((n) => n + 1)
        }}
      />

      <AlertDialog open={pendingDate !== null} onOpenChange={(open) => !open && setPendingDate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>该日暂无复盘，是否新建？</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDate ? `${pendingDate} 还没有复盘记录。确认后将打开编辑页。` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!pendingDate) return
                navigate(notesPath({ date: pendingDate, from, to, strategy_id: notesStrategy() }))
              }}
            >
              新建复盘
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function ChartGrid({
  groups,
  metrics,
  sealThreshold,
  isMobile,
  focusDate,
  onChartClick,
  tall = false,
}: {
  groups: { strategy: Strategy; data: ChartRow[] }[]
  metrics: (typeof METRIC_OPTIONS)[number][]
  sealThreshold: number
  isMobile: boolean
  focusDate: string | null
  onChartClick: (state: unknown) => void
  tall?: boolean
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {groups.map((group) => (
        <section key={group.strategy.id} className="grid min-w-0 gap-2">
          <h3 className="flex min-w-0 items-baseline gap-2">
            <span className="shrink-0 text-base font-medium">
              {group.strategy.is_active
                ? group.strategy.name
                : `${group.strategy.name}（已停用）`}
            </span>
            {group.strategy.current_detail.trim() ? (
              <span className="min-w-0 truncate text-xs font-normal text-muted-foreground">
                {group.strategy.current_detail.trim().replace(/\s+/g, " ")}
              </span>
            ) : null}
          </h3>
          <div className="grid gap-2">
            {metrics.map((metric) => (
              <MiniChart
                key={metric.key}
                title={metric.label}
                data={group.data}
                metric={metric}
                sealThreshold={sealThreshold}
                isMobile={isMobile}
                focusDate={focusDate}
                onChartClick={onChartClick}
                tall={tall}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function MiniChart({
  title,
  data,
  metric,
  sealThreshold,
  isMobile,
  focusDate,
  onChartClick,
  tall = false,
}: {
  title: string
  data: ChartRow[]
  metric: (typeof METRIC_OPTIONS)[number]
  sealThreshold: number
  isMobile: boolean
  focusDate: string | null
  onChartClick: (state: unknown) => void
  tall?: boolean
}) {
  const isRate = metric.kind === "rate"
  const isSeal = metric.key === "seal_rate"
  return (
    <div className="grid gap-2">
      <div className="text-xs text-muted-foreground">{title}</div>
      <ChartContainer
        config={chartConfig}
        className={
          tall
            ? "aspect-auto h-[200px] w-full md:h-[240px]"
            : "aspect-auto h-[140px] w-full md:h-[160px]"
        }
      >
        <LineChart
          accessibilityLayer
          data={data}
          margin={isMobile ? { left: 0, right: 8, top: 12, bottom: 0 } : { right: 12, top: 12 }}
          onClick={onChartClick}
        >
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            interval={isMobile ? "preserveStartEnd" : undefined}
            minTickGap={isMobile ? 28 : 8}
            tickFormatter={(v: string) => (isMobile && v.length >= 10 ? v.slice(5) : v)}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={isMobile ? 32 : 40}
            tickCount={isMobile ? 4 : undefined}
            domain={isRate ? [0, 100] : undefined}
            tickFormatter={isRate ? (v: number) => `${v}%` : undefined}
          />
          {isSeal ? (
            <>
              <ReferenceArea
                y1={0}
                y2={sealThreshold}
                fill="#16a34a"
                fillOpacity={isMobile ? 0.12 : 0.08}
                strokeOpacity={0}
                ifOverflow="visible"
              />
              <ReferenceArea
                y1={sealThreshold}
                y2={100}
                fill="#dc2626"
                fillOpacity={isMobile ? 0.12 : 0.08}
                strokeOpacity={0}
                ifOverflow="visible"
              />
              <ReferenceLine
                y={sealThreshold}
                stroke="#dc2626"
                strokeDasharray="6 4"
                strokeWidth={isMobile ? 1.5 : 1}
                ifOverflow="visible"
                label={{
                  value: `${sealThreshold}%`,
                  position: "insideTopRight",
                  fill: "var(--muted-foreground)",
                  fontSize: isMobile ? 10 : 11,
                }}
              />
            </>
          ) : null}
          <ChartTooltip
            trigger={isMobile ? "click" : "hover"}
            content={<SingleTooltip isRate={isRate} />}
          />
          {focusDate ? (
            <ReferenceLine
              x={focusDate}
              stroke="var(--foreground)"
              strokeDasharray="4 4"
              ifOverflow="visible"
            />
          ) : null}
          <Line
            type="monotone"
            dataKey={metric.key}
            stroke={`var(--color-${metric.key})`}
            strokeWidth={2}
            dot={isMobile ? { r: 4 } : false}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ChartContainer>
    </div>
  )
}

type TooltipItem = {
  dataKey?: string | number
  name?: string
  value?: number | string
  color?: string
  payload?: { source?: string }
}

function SingleTooltip({
  active,
  payload,
  label,
  isRate,
}: {
  active?: boolean
  payload?: TooltipItem[]
  label?: string
  isRate: boolean
}) {
  if (!active || !payload?.length) return null
  const item = payload[0]
  const source = item.payload?.source
  const key = String(item.dataKey ?? item.name ?? "")
  const cfg = chartConfig[key as keyof typeof chartConfig]
  const text = isRate ? `${Number(item.value).toFixed(1)}%` : String(item.value ?? "")
  return (
    <div className="max-w-[min(100vw-2rem,16rem)] rounded-lg border bg-background px-3 py-2 text-xs shadow-sm">
      <div className="mb-1 flex items-center gap-1.5 font-medium">
        <span>{label}</span>
        <SourceBadge source={source} />
        <SourceHint source={source} />
      </div>
      <div className="flex items-center gap-2">
        <span className="size-2 rounded-full" style={{ background: item.color }} />
        <span>{cfg?.label ?? key}</span>
        <span className="ml-auto tabular-nums">{text}</span>
      </div>
    </div>
  )
}
