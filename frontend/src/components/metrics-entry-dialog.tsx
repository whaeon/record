import { useEffect, useMemo, useRef, useState, type FormEvent } from "react"
import { ChevronsUpDown, ClipboardList } from "lucide-react"
import { toast } from "sonner"
import {
  createMetric,
  existingMetricFromConflict,
  updateMetric,
  type CreateMetricInput,
  type StrategyMetric,
} from "@/api/metrics"
import { listStrategies, type Strategy } from "@/api/strategies"
import { todayISO } from "@/lib/date"
import { toastApiError } from "@/lib/notify"
import { DatePicker } from "@/components/date-picker"
import { EmptyState } from "@/components/empty-state"
import { SourceBadge } from "@/components/source-badge"
import { Button } from "@/components/ui/button"
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type BatchRow = {
  totalPicks: string
  limitUpCount: string
  failedLimitCount: string
}

const emptyBatchRow = (): BatchRow => ({
  totalPicks: "",
  limitUpCount: "",
  failedLimitCount: "",
})

function parseNonNegInt(raw: string): number | null {
  const t = raw.trim()
  if (t === "") return 0
  if (!/^\d+$/.test(t)) return null
  return Number(t)
}

type ParsedBatchRow =
  | { kind: "empty" }
  | { kind: "invalid" }
  | { kind: "ok"; total_picks: number; limit_up_count: number; failed_limit_count: number }

function parseBatchRow(row: BatchRow): ParsedBatchRow {
  const filled = [row.totalPicks, row.limitUpCount, row.failedLimitCount].some((v) => v.trim() !== "")
  if (!filled) return { kind: "empty" }
  const total_picks = parseNonNegInt(row.totalPicks)
  const limit_up_count = parseNonNegInt(row.limitUpCount)
  const failed_limit_count = parseNonNegInt(row.failedLimitCount)
  if (total_picks === null || limit_up_count === null || failed_limit_count === null) {
    return { kind: "invalid" }
  }
  return { kind: "ok", total_picks, limit_up_count, failed_limit_count }
}

export function MetricsEntryDialog({
  open,
  onOpenChange,
  date: initialDate,
  dates = [],
  onSaved,
  onNeedStrategies,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  date?: string
  dates?: string[]
  onSaved?: () => void
  onNeedStrategies?: () => void
}) {
  const [strategies, setStrategies] = useState<Strategy[]>([])
  const [mode, setMode] = useState<"batch" | "single">("batch")

  const [date, setDate] = useState(initialDate ?? todayISO())
  const [strategyId, setStrategyId] = useState<number>(0)
  const [totalPicks, setTotalPicks] = useState(0)
  const [limitUpCount, setLimitUpCount] = useState(0)
  const [failedLimitCount, setFailedLimitCount] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [conflict, setConflict] = useState<StrategyMetric | null>(null)
  const [updating, setUpdating] = useState(false)

  const [batchDate, setBatchDate] = useState(initialDate ?? todayISO())
  const [batchRows, setBatchRows] = useState<Record<number, BatchRow>>({})
  const [batchSubmitting, setBatchSubmitting] = useState(false)
  const [batchConflicts, setBatchConflicts] = useState<
    { strategy: Strategy; existing: StrategyMetric; payload: CreateMetricInput }[]
  >([])
  const [batchUpdating, setBatchUpdating] = useState(false)
  const [batchCreatedCount, setBatchCreatedCount] = useState(0)
  const skipBatchCloseToast = useRef(false)

  const empty = strategies.length === 0
  const activeStrategies = useMemo(() => strategies.filter((s) => s.is_active), [strategies])
  const noActive = activeStrategies.length === 0
  const selected = useMemo(
    () => activeStrategies.find((s) => s.id === strategyId) ?? null,
    [activeStrategies, strategyId]
  )

  useEffect(() => {
    if (!open) return
    const d = initialDate ?? todayISO()
    setDate(d)
    setBatchDate(d)
    setMode("batch")
    setBatchRows({})
    setStrategyId(0)
    setTotalPicks(0)
    setLimitUpCount(0)
    setFailedLimitCount(0)
    listStrategies()
      .then((list) => {
        setStrategies(list)
        const active = list.find((s) => s.is_active)
        setStrategyId(active?.id ?? 0)
      })
      .catch((err: unknown) => {
        toastApiError(err, "加载交易策略失败")
      })
  }, [open, initialDate])

  async function onSubmitMetric(e: FormEvent) {
    e.preventDefault()
    if (empty || strategyId <= 0) {
      toast.error("请先选择交易策略")
      return
    }
    setSubmitting(true)
    const payload = {
      date,
      strategy_id: strategyId,
      total_picks: totalPicks,
      limit_up_count: limitUpCount,
      failed_limit_count: failedLimitCount,
    }
    try {
      await createMetric(payload)
      onSaved?.()
      toast.success("已保存")
      setTotalPicks(0)
      setLimitUpCount(0)
      setFailedLimitCount(0)
    } catch (err) {
      const existing = existingMetricFromConflict(err)
      if (existing) {
        setConflict(existing)
      } else {
        toastApiError(err, "提交失败", () => void onSubmitMetric(e))
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function onConfirmUpdate() {
    if (!conflict || strategyId <= 0) return
    setUpdating(true)
    try {
      await updateMetric(conflict.id, {
        date,
        strategy_id: strategyId,
        total_picks: totalPicks,
        limit_up_count: limitUpCount,
        failed_limit_count: failedLimitCount,
      })
      setConflict(null)
      setTotalPicks(0)
      setLimitUpCount(0)
      setFailedLimitCount(0)
      onSaved?.()
      toast.success("已更新")
    } catch (err) {
      toastApiError(err, "更新失败", () => void onConfirmUpdate())
    } finally {
      setUpdating(false)
    }
  }

  function batchRowFor(id: number): BatchRow {
    return batchRows[id] ?? emptyBatchRow()
  }

  function setBatchField(id: number, field: keyof BatchRow, value: string) {
    setBatchRows((prev) => ({
      ...prev,
      [id]: { ...emptyBatchRow(), ...prev[id], [field]: value },
    }))
  }

  function collectFilledRows():
    | { ok: true; items: { strategy: Strategy; payload: CreateMetricInput }[] }
    | { ok: false; reason: "empty" | "invalid" } {
    const items: { strategy: Strategy; payload: CreateMetricInput }[] = []
    for (const s of activeStrategies) {
      const parsed = parseBatchRow(batchRowFor(s.id))
      if (parsed.kind === "empty") continue
      if (parsed.kind === "invalid") return { ok: false, reason: "invalid" }
      items.push({
        strategy: s,
        payload: {
          date: batchDate,
          strategy_id: s.id,
          total_picks: parsed.total_picks,
          limit_up_count: parsed.limit_up_count,
          failed_limit_count: parsed.failed_limit_count,
        },
      })
    }
    if (items.length === 0) return { ok: false, reason: "empty" }
    return { ok: true, items }
  }

  function clearBatchRows(ids: number[]) {
    setBatchRows((prev) => {
      const next = { ...prev }
      for (const id of ids) delete next[id]
      return next
    })
  }

  async function onSubmitBatch() {
    const collected = collectFilledRows()
    if (!collected.ok) {
      toast.error(collected.reason === "invalid" ? "请填写非负整数" : "至少填写一行再提交")
      return
    }
    setBatchSubmitting(true)
    let created = 0
    const conflicts: { strategy: Strategy; existing: StrategyMetric; payload: CreateMetricInput }[] = []
    const createdIds: number[] = []
    try {
      for (const item of collected.items) {
        try {
          await createMetric(item.payload)
          created += 1
          createdIds.push(item.strategy.id)
        } catch (err) {
          const existing = existingMetricFromConflict(err)
          if (existing) {
            conflicts.push({ strategy: item.strategy, existing, payload: item.payload })
          } else {
            toastApiError(err, `${item.strategy.name}：提交失败`, () => void onSubmitBatch())
            return
          }
        }
      }
      clearBatchRows(createdIds)
      if (created > 0) onSaved?.()
      if (conflicts.length > 0) {
        setBatchCreatedCount(created)
        setBatchConflicts(conflicts)
      } else {
        setBatchCreatedCount(0)
        toast.success(`成功 ${created} 条，更新 0 条`)
      }
    } finally {
      setBatchSubmitting(false)
    }
  }

  async function onConfirmBatchUpdate() {
    if (batchConflicts.length === 0) return
    setBatchUpdating(true)
    let updated = 0
    const updatedIds: number[] = []
    try {
      for (const item of batchConflicts) {
        try {
          await updateMetric(item.existing.id, item.payload)
          updated += 1
          updatedIds.push(item.strategy.id)
        } catch (err) {
          toastApiError(err, `${item.strategy.name}：更新失败`, () => void onConfirmBatchUpdate())
          clearBatchRows(updatedIds)
          return
        }
      }
      clearBatchRows(updatedIds)
      skipBatchCloseToast.current = true
      setBatchConflicts([])
      if (updated > 0) onSaved?.()
      toast.success(`成功 ${batchCreatedCount} 条，更新 ${updated} 条`)
      setBatchCreatedCount(0)
    } finally {
      setBatchUpdating(false)
    }
  }

  const emptyAction = (
    <Button
      type="button"
      onClick={() => {
        onOpenChange(false)
        onNeedStrategies?.()
      }}
    >
      {empty ? "去创建交易策略" : "去管理交易策略"}
    </Button>
  )

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>录入指标</DialogTitle>
          </DialogHeader>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={mode === "batch" ? "default" : "outline"}
              onClick={() => setMode("batch")}
            >
              批量
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === "single" ? "default" : "outline"}
              onClick={() => setMode("single")}
            >
              单条
            </Button>
          </div>
          {noActive ? (
            <EmptyState
              icon={ClipboardList}
              title={empty ? "请先创建交易策略" : "请先启用交易策略"}
              description={empty ? "创建后即可录入每日指标。" : "启用至少一个策略后再录入。"}
              action={emptyAction}
            />
          ) : mode === "batch" ? (
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="batch-date">日期</Label>
                <DatePicker id="batch-date" mode="entry" value={batchDate} dates={dates} onChange={setBatchDate} />
              </div>
              <ul className="grid gap-3 md:hidden">
                {activeStrategies.map((s) => {
                  const row = batchRowFor(s.id)
                  return (
                    <li key={s.id} className="grid gap-3 rounded-lg border p-3">
                      <div className="font-medium">{s.name}</div>
                      <div className="grid gap-2">
                        <Label htmlFor={`batch-picks-${s.id}`}>筛出票数</Label>
                        <Input
                          id={`batch-picks-${s.id}`}
                          type="number"
                          min={0}
                          step={1}
                          inputMode="numeric"
                          value={row.totalPicks}
                          onChange={(e) => setBatchField(s.id, "totalPicks", e.target.value)}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor={`batch-limit-${s.id}`}>涨停数</Label>
                        <Input
                          id={`batch-limit-${s.id}`}
                          type="number"
                          min={0}
                          step={1}
                          inputMode="numeric"
                          value={row.limitUpCount}
                          onChange={(e) => setBatchField(s.id, "limitUpCount", e.target.value)}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor={`batch-fail-${s.id}`}>炸板数</Label>
                        <Input
                          id={`batch-fail-${s.id}`}
                          type="number"
                          min={0}
                          step={1}
                          inputMode="numeric"
                          value={row.failedLimitCount}
                          onChange={(e) => setBatchField(s.id, "failedLimitCount", e.target.value)}
                        />
                      </div>
                    </li>
                  )
                })}
              </ul>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>交易策略</TableHead>
                      <TableHead>筛出票数</TableHead>
                      <TableHead>涨停数</TableHead>
                      <TableHead>炸板数</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeStrategies.map((s) => {
                      const row = batchRowFor(s.id)
                      return (
                        <TableRow key={s.id}>
                          <TableCell className="font-medium">{s.name}</TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={0}
                              step={1}
                              inputMode="numeric"
                              aria-label={`${s.name} 筛出票数`}
                              value={row.totalPicks}
                              onChange={(e) => setBatchField(s.id, "totalPicks", e.target.value)}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={0}
                              step={1}
                              inputMode="numeric"
                              aria-label={`${s.name} 涨停数`}
                              value={row.limitUpCount}
                              onChange={(e) => setBatchField(s.id, "limitUpCount", e.target.value)}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={0}
                              step={1}
                              inputMode="numeric"
                              aria-label={`${s.name} 炸板数`}
                              value={row.failedLimitCount}
                              onChange={(e) => setBatchField(s.id, "failedLimitCount", e.target.value)}
                            />
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
              <Button type="button" disabled={batchSubmitting} onClick={() => void onSubmitBatch()}>
                {batchSubmitting ? "提交中..." : "全部提交"}
              </Button>
            </div>
          ) : (
            <form className="grid gap-4" onSubmit={onSubmitMetric}>
              <div className="grid gap-2">
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
                      {selected ? selected.name : "选择交易策略"}
                      <ChevronsUpDown className="size-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
                    <Command>
                      <CommandInput placeholder="搜索交易策略" />
                      <CommandList>
                        <CommandEmpty>未找到交易策略</CommandEmpty>
                        <CommandGroup>
                          {activeStrategies.map((s) => (
                            <CommandItem
                              key={s.id}
                              value={s.name}
                              data-checked={s.id === strategyId || undefined}
                              onSelect={() => {
                                setStrategyId(s.id)
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
              <div className="grid gap-2">
                <Label htmlFor="date">日期</Label>
                <DatePicker id="date" mode="entry" value={date} dates={dates} onChange={setDate} />
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
              <Button type="submit" disabled={submitting || strategyId <= 0}>
                {submitting ? "提交中..." : "提交"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={conflict !== null} onOpenChange={(open) => !open && setConflict(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>该日期已有此交易策略的记录，是否修改？</AlertDialogTitle>
            <AlertDialogDescription>
              {conflict ? (
                <span className="inline-flex flex-wrap items-center gap-1.5">
                  已有记录：筛出票数 {conflict.total_picks}，涨停数 {conflict.limit_up_count}，炸板数 {conflict.failed_limit_count}
                  <SourceBadge source={conflict.source} />
                  。确认后将覆盖为当前表单中的数字。
                </span>
              ) : (
                ""
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={updating}>取消</AlertDialogCancel>
            <AlertDialogAction
              disabled={updating}
              onClick={(e) => {
                e.preventDefault()
                void onConfirmUpdate()
              }}
            >
              {updating ? "更新中..." : "确认修改"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={batchConflicts.length > 0}
        onOpenChange={(open) => {
          if (open) return
          if (batchUpdating) return
          if (skipBatchCloseToast.current) {
            skipBatchCloseToast.current = false
            setBatchCreatedCount(0)
            setBatchConflicts([])
            return
          }
          if (batchCreatedCount > 0) {
            toast.success(`成功 ${batchCreatedCount} 条，更新 0 条`)
          }
          setBatchCreatedCount(0)
          setBatchConflicts([])
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>部分策略该日期已有记录，是否覆盖？</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="grid gap-2 text-sm text-muted-foreground">
                <p>确认后将用当前填写的数字覆盖以下记录：</p>
                <ul className="grid gap-1">
                  {batchConflicts.map((item) => (
                    <li key={item.strategy.id} className="inline-flex flex-wrap items-center gap-1.5">
                      {item.strategy.name}：筛出 {item.existing.total_picks}，涨停{" "}
                      {item.existing.limit_up_count}，炸板 {item.existing.failed_limit_count}
                      <SourceBadge source={item.existing.source} />
                    </li>
                  ))}
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={batchUpdating}>取消</AlertDialogCancel>
            <AlertDialogAction
              disabled={batchUpdating}
              onClick={(e) => {
                e.preventDefault()
                void onConfirmBatchUpdate()
              }}
            >
              {batchUpdating ? "更新中..." : "确认覆盖"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
