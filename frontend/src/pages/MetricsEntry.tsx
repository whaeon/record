import { useEffect, useState, type FormEvent } from "react"
import { createMetric, listMetrics, uniqueSectors } from "@/api/metrics"
import { todayISO } from "@/lib/date"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function MetricsEntry() {
  const [date, setDate] = useState(todayISO)
  const [sectorName, setSectorName] = useState("")
  const [totalPicks, setTotalPicks] = useState(0)
  const [limitUpCount, setLimitUpCount] = useState(0)
  const [failedLimitCount, setFailedLimitCount] = useState(0)
  const [sectors, setSectors] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    listMetrics()
      .then((list) => setSectors(uniqueSectors(list)))
      .catch(() => {})
  }, [])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setMessage("")
    setError("")
    const name = sectorName.trim()
    if (!name) {
      setError("请填写板块名称")
      return
    }
    setSubmitting(true)
    try {
      await createMetric({
        date,
        sector_name: name,
        total_picks: totalPicks,
        limit_up_count: limitUpCount,
        failed_limit_count: failedLimitCount,
      })
      setMessage("已保存")
      setTotalPicks(0)
      setLimitUpCount(0)
      setFailedLimitCount(0)
      if (!sectors.includes(name)) {
        setSectors([...sectors, name].sort())
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "提交失败")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card className="mx-auto max-w-xl">
      <CardHeader>
        <CardTitle>指标录入</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={onSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="date">日期</Label>
            <Input
              id="date"
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="sector">板块名称</Label>
            <Input
              id="sector"
              list="sector-options"
              required
              placeholder="选择或输入板块"
              value={sectorName}
              onChange={(e) => setSectorName(e.target.value)}
            />
            <datalist id="sector-options">
              {sectors.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="total_picks">筛出票数</Label>
            <Input
              id="total_picks"
              type="number"
              min={0}
              step={1}
              required
              value={totalPicks}
              onChange={(e) => setTotalPicks(Number(e.target.value))}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="limit_up_count">涨停数</Label>
            <Input
              id="limit_up_count"
              type="number"
              min={0}
              step={1}
              required
              value={limitUpCount}
              onChange={(e) => setLimitUpCount(Number(e.target.value))}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="failed_limit_count">炸板数</Label>
            <Input
              id="failed_limit_count"
              type="number"
              min={0}
              step={1}
              required
              value={failedLimitCount}
              onChange={(e) => setFailedLimitCount(Number(e.target.value))}
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
          <Button type="submit" disabled={submitting}>
            {submitting ? "提交中..." : "提交"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
