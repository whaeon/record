import { useEffect, useMemo, useState } from "react"
import {
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts"
import { listMetrics, uniqueSectors, type SectorMetric } from "@/api/metrics"
import { daysAgoISO, formatPercent, todayISO } from "@/lib/date"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const chartConfig = {
  total_picks: { label: "筛出票数", color: "var(--chart-1)" },
  limit_up_count: { label: "涨停数", color: "var(--chart-2)" },
  failed_limit_count: { label: "炸板数", color: "var(--chart-3)" },
  seal_rate_pct: { label: "封板率", color: "var(--chart-4)" },
  break_rate_pct: { label: "炸板率", color: "var(--chart-5)" },
} satisfies ChartConfig

type ChartRow = SectorMetric & {
  seal_rate_pct: number
  break_rate_pct: number
}

export default function MetricsChart() {
  const [from, setFrom] = useState(daysAgoISO(30))
  const [to, setTo] = useState(todayISO())
  const [sector, setSector] = useState("")
  const [sectors, setSectors] = useState<string[]>([])
  const [rows, setRows] = useState<SectorMetric[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    listMetrics()
      .then((list) => setSectors(uniqueSectors(list)))
      .catch(() => {})
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError("")
    listMetrics({
      from,
      to,
      sector: sector.trim() || undefined,
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
  }, [from, to, sector])

  const chartData = useMemo<ChartRow[]>(
    () =>
      rows.map((row) => ({
        ...row,
        seal_rate_pct: row.seal_rate * 100,
        break_rate_pct: row.break_rate * 100,
      })),
    [rows]
  )

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>筛选</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="grid gap-2">
              <Label htmlFor="from">开始日期</Label>
              <Input
                id="from"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="to">结束日期</Label>
              <Input
                id="to"
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
            <div className="grid min-w-48 gap-2">
              <Label htmlFor="sector-filter">板块</Label>
              <Input
                id="sector-filter"
                list="chart-sector-options"
                placeholder="全部板块"
                value={sector}
                onChange={(e) => setSector(e.target.value)}
              />
              <datalist id="chart-sector-options">
                {sectors.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
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
            <p className="text-sm text-muted-foreground">暂无数据</p>
          ) : (
            <ChartContainer config={chartConfig} className="aspect-auto h-[360px] w-full">
              <LineChart accessibilityLayer data={chartData}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                />
                <YAxis
                  yAxisId="count"
                  tickLine={false}
                  axisLine={false}
                  width={40}
                />
                <YAxis
                  yAxisId="rate"
                  orientation="right"
                  tickLine={false}
                  axisLine={false}
                  width={48}
                  domain={[0, 100]}
                  tickFormatter={(v: number) => `${v}%`}
                />
                <ChartTooltip content={<DualAxisTooltip />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Line
                  yAxisId="count"
                  type="monotone"
                  dataKey="total_picks"
                  stroke="var(--color-total_picks)"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  yAxisId="count"
                  type="monotone"
                  dataKey="limit_up_count"
                  stroke="var(--color-limit_up_count)"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  yAxisId="count"
                  type="monotone"
                  dataKey="failed_limit_count"
                  stroke="var(--color-failed_limit_count)"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  yAxisId="rate"
                  type="monotone"
                  dataKey="seal_rate_pct"
                  stroke="var(--color-seal_rate_pct)"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  yAxisId="rate"
                  type="monotone"
                  dataKey="break_rate_pct"
                  stroke="var(--color-break_rate_pct)"
                  strokeWidth={2}
                  dot={false}
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>日期</TableHead>
                <TableHead>板块</TableHead>
                <TableHead className="text-right">筛出票数</TableHead>
                <TableHead className="text-right">涨停数</TableHead>
                <TableHead className="text-right">炸板数</TableHead>
                <TableHead className="text-right">封板率</TableHead>
                <TableHead className="text-right">炸板率</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-muted-foreground">
                    暂无数据
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.date}</TableCell>
                    <TableCell>{row.sector_name}</TableCell>
                    <TableCell className="text-right">{row.total_picks}</TableCell>
                    <TableCell className="text-right">{row.limit_up_count}</TableCell>
                    <TableCell className="text-right">{row.failed_limit_count}</TableCell>
                    <TableCell className="text-right">{formatPercent(row.seal_rate)}</TableCell>
                    <TableCell className="text-right">{formatPercent(row.break_rate)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
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
    <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-sm">
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
