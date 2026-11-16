import { useEffect, useMemo, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { useMediaQuery } from "@/hooks/use-media-query"
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts"
import { ChevronsUpDown } from "lucide-react"
import { listMetricDates, listMetrics, type StrategyMetric } from "@/api/metrics"
import { listNotes } from "@/api/notes"
import { listStrategies, type Strategy } from "@/api/strategies"
import { DatePicker } from "@/components/date-picker"
import { daysAgoISO, formatPercent, todayISO } from "@/lib/date"
import { notesPath, parseDateParam, parseStrategyParam } from "@/lib/nav"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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

const chartConfig = {
  total_picks: { label: "筛出票数", color: "var(--chart-1)" },
  limit_up_count: { label: "涨停数", color: "var(--chart-2)" },
  failed_limit_count: { label: "炸板数", color: "var(--chart-3)" },
  seal_rate_pct: { label: "封板率", color: "var(--chart-4)" },
  break_rate_pct: { label: "炸板率", color: "var(--chart-5)" },
} satisfies ChartConfig

type ChartRow = StrategyMetric & {
  seal_rate_pct: number
  break_rate_pct: number
}

export default function MetricsChart() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const defaultFrom = daysAgoISO(30)
  const defaultTo = todayISO()
  const from = parseDateParam(searchParams.get("from")) ?? defaultFrom
  const to = parseDateParam(searchParams.get("to")) ?? defaultTo
  const strategyId = parseStrategyParam(searchParams.get("strategy_id"))
  const focusDate = parseDateParam(searchParams.get("date"))
  const [strategies, setStrategies] = useState<Strategy[]>([])
  const [rows, setRows] = useState<StrategyMetric[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [pickerOpen, setPickerOpen] = useState(false)
  const [existingDates, setExistingDates] = useState<string[]>([])
  const [noteDates, setNoteDates] = useState<Set<string>>(new Set())
  const [pendingDate, setPendingDate] = useState<string | null>(null)
  const isMobile = useMediaQuery("(max-width: 767px)")

  function patchParams(next: { from?: string; to?: string; strategy_id?: number; date?: string | null }) {
    const q = new URLSearchParams()
    q.set("from", next.from ?? from)
    q.set("to", next.to ?? to)
    const sid = next.strategy_id ?? strategyId
    if (sid > 0) q.set("strategy_id", String(sid))
    const d = next.date === undefined ? focusDate : next.date
    if (d) q.set("date", d)
    setSearchParams(q, { replace: true })
  }

  const selected = useMemo(
    () => strategies.find((s) => s.id === strategyId) ?? null,
    [strategies, strategyId]
  )

  useEffect(() => {
    listStrategies()
      .then(setStrategies)
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
    setError("")
    listMetrics({
      from,
      to,
      strategy_id: strategyId > 0 ? strategyId : undefined,
    })
      .then((list) => {
        if (!cancelled) setRows(list)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "查询失败")
          setRows([])
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [from, to, strategyId])

  const chartData = useMemo<ChartRow[]>(
    () =>
      rows.map((row) => ({
        ...row,
        seal_rate_pct: row.seal_rate * 100,
        break_rate_pct: row.break_rate * 100,
      })),
    [rows]
  )

  function goToNote(date: string) {
    if (noteDates.has(date)) {
      navigate(notesPath({ date, from, to, strategy_id: strategyId }))
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

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>筛选</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 md:flex md:flex-wrap md:items-end">
            <div className="grid min-w-0 gap-2">
              <Label htmlFor="from">开始日期</Label>
              <DatePicker
                id="from"
                mode="filter"
                value={from}
                dates={existingDates}
                onChange={(v) => patchParams({ from: v })}
              />
            </div>
            <div className="grid min-w-0 gap-2">
              <Label htmlFor="to">结束日期</Label>
              <DatePicker
                id="to"
                mode="filter"
                value={to}
                dates={existingDates}
                onChange={(v) => patchParams({ to: v })}
              />
            </div>
            <div className="grid min-w-0 gap-2 sm:col-span-2 md:min-w-48">
              <Label>交易策略</Label>
              <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={pickerOpen}
                    className="w-full justify-between font-normal"
                  >
                    {selected ? selected.name : "全部交易策略"}
                    <ChevronsUpDown className="size-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
                  <Command>
                    <CommandInput placeholder="搜索交易策略" />
                    <CommandList>
                      <CommandEmpty>未找到交易策略</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="全部交易策略"
                          data-checked={strategyId === 0 || undefined}
                          onSelect={() => {
                            patchParams({ strategy_id: 0 })
                            setPickerOpen(false)
                          }}
                        >
                          全部交易策略
                        </CommandItem>
                        {strategies.map((s) => (
                          <CommandItem
                            key={s.id}
                            value={s.name}
                            data-checked={s.id === strategyId || undefined}
                            onSelect={() => {
                              patchParams({ strategy_id: s.id })
                              setPickerOpen(false)
                            }}
                          >
                            {s.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>历史走势</CardTitle>
        </CardHeader>
        <CardContent>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {loading ? (
            <p className="text-sm text-muted-foreground">加载中...</p>
          ) : chartData.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无指标数据，请先在交易策略页录入</p>
          ) : (
            <ChartContainer config={chartConfig} className="aspect-auto h-[280px] w-full md:h-[360px]">
              <LineChart
                accessibilityLayer
                data={chartData}
                margin={isMobile ? { left: 0, right: 8, top: 8, bottom: 0 } : undefined}
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
                  tickFormatter={(v: string) =>
                    isMobile && v.length >= 10 ? v.slice(5) : v
                  }
                />
                <YAxis
                  yAxisId="count"
                  tickLine={false}
                  axisLine={false}
                  width={isMobile ? 28 : 40}
                  tickCount={isMobile ? 4 : undefined}
                />
                <YAxis
                  yAxisId="rate"
                  orientation="right"
                  tickLine={false}
                  axisLine={false}
                  width={isMobile ? 36 : 48}
                  domain={[0, 100]}
                  tickCount={isMobile ? 4 : undefined}
                  tickFormatter={(v: number) => `${v}%`}
                />
                <ChartTooltip
                  trigger={isMobile ? "click" : "hover"}
                  content={<DualAxisTooltip />}
                />
                {focusDate ? (
                  <ReferenceLine
                    x={focusDate}
                    stroke="var(--foreground)"
                    strokeDasharray="4 4"
                    ifOverflow="visible"
                  />
                ) : null}
                <ChartLegend content={<ChartLegendContent />} />
                <Line
                  yAxisId="count"
                  type="monotone"
                  dataKey="total_picks"
                  stroke="var(--color-total_picks)"
                  strokeWidth={2}
                  dot={isMobile ? { r: 4 } : false}
                  activeDot={{ r: 6 }}
                />
                <Line
                  yAxisId="count"
                  type="monotone"
                  dataKey="limit_up_count"
                  stroke="var(--color-limit_up_count)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 6 }}
                />
                <Line
                  yAxisId="count"
                  type="monotone"
                  dataKey="failed_limit_count"
                  stroke="var(--color-failed_limit_count)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 6 }}
                />
                <Line
                  yAxisId="rate"
                  type="monotone"
                  dataKey="seal_rate_pct"
                  stroke="var(--color-seal_rate_pct)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 6 }}
                />
                <Line
                  yAxisId="rate"
                  type="monotone"
                  dataKey="break_rate_pct"
                  stroke="var(--color-break_rate_pct)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>每日明细</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无指标数据</p>
          ) : (
            <>
              <ul className="grid gap-3 md:hidden">
                {rows.map((row) => (
                  <li
                    key={row.id}
                    className={[
                      "grid gap-2 rounded-lg border p-3",
                      row.date === focusDate ? "border-ring bg-muted/40" : "",
                    ].join(" ")}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <button
                        type="button"
                        className="min-h-11 font-medium underline-offset-4 hover:underline"
                        onClick={() => goToNote(row.date)}
                      >
                        {row.date}
                      </button>
                      <span className="truncate text-sm text-muted-foreground">
                        {row.strategy_name}
                      </span>
                    </div>
                    <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                      <div className="flex justify-between gap-2">
                        <dt className="text-muted-foreground">筛出</dt>
                        <dd className="tabular-nums">{row.total_picks}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-muted-foreground">涨停</dt>
                        <dd className="tabular-nums">{row.limit_up_count}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-muted-foreground">炸板</dt>
                        <dd className="tabular-nums">{row.failed_limit_count}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-muted-foreground">封板率</dt>
                        <dd className="tabular-nums">{formatPercent(row.seal_rate)}</dd>
                      </div>
                      <div className="col-span-2 flex justify-between gap-2">
                        <dt className="text-muted-foreground">炸板率</dt>
                        <dd className="tabular-nums">{formatPercent(row.break_rate)}</dd>
                      </div>
                    </dl>
                  </li>
                ))}
              </ul>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>日期</TableHead>
                      <TableHead>交易策略</TableHead>
                      <TableHead className="text-right">筛出票数</TableHead>
                      <TableHead className="text-right">涨停数</TableHead>
                      <TableHead className="text-right">炸板数</TableHead>
                      <TableHead className="text-right">封板率</TableHead>
                      <TableHead className="text-right">炸板率</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow
                        key={row.id}
                        className="cursor-pointer"
                        data-state={row.date === focusDate ? "selected" : undefined}
                        onClick={() => goToNote(row.date)}
                      >
                        <TableCell>{row.date}</TableCell>
                        <TableCell>{row.strategy_name}</TableCell>
                        <TableCell className="text-right">{row.total_picks}</TableCell>
                        <TableCell className="text-right">{row.limit_up_count}</TableCell>
                        <TableCell className="text-right">{row.failed_limit_count}</TableCell>
                        <TableCell className="text-right">{formatPercent(row.seal_rate)}</TableCell>
                        <TableCell className="text-right">{formatPercent(row.break_rate)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

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
                navigate(notesPath({ date: pendingDate, from, to, strategy_id: strategyId }))
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

type TooltipItem = {
  dataKey?: string | number
  name?: string
  value?: number | string
  color?: string
}

function DualAxisTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: TooltipItem[]
  label?: string
}) {
  if (!active || !payload?.length) {
    return null
  }
  return (
    <div className="max-w-[min(100vw-2rem,18rem)] rounded-lg border bg-background px-3 py-2 text-xs shadow-sm">
      <div className="mb-1 font-medium">{label}</div>
      {payload.map((item) => {
        const key = String(item.dataKey ?? item.name ?? "")
        const isRate = key.endsWith("_pct")
        const text = isRate
          ? `${Number(item.value).toFixed(1)}%`
          : String(item.value ?? "")
        const cfg = chartConfig[key as keyof typeof chartConfig]
        return (
          <div key={key} className="flex items-center gap-2">
            <span
              className="size-2 rounded-full"
              style={{ background: item.color }}
            />
            <span>{cfg?.label ?? key}</span>
            <span className="ml-auto tabular-nums">{text}</span>
          </div>
        )
      })}
    </div>
  )
}
