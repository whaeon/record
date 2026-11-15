import { useEffect, useMemo, useState, type FormEvent } from "react"
import { ChevronsUpDown } from "lucide-react"
import { toast } from "sonner"
import { createMetric, existingMetricFromConflict, updateMetric, type StrategyMetric } from "@/api/metrics"
import {
  createStrategy,
  deleteStrategy,
  listRevisions,
  listStrategies,
  updateStrategy,
  type Strategy,
  type StrategyRevision,
} from "@/api/strategies"
import { todayISO } from "@/lib/date"
import { ApiError } from "@/lib/http"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString("zh-CN", { hour12: false })
}

function summarize(text: string, max = 48): string {
  const t = text.replace(/\s+/g, " ").trim()
  if (t.length <= max) return t
  return `${t.slice(0, max)}...`
}

export default function MetricsEntry() {
  const [strategies, setStrategies] = useState<Strategy[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState("")
  const [detail, setDetail] = useState("")
  const [creating, setCreating] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<Strategy | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [editing, setEditing] = useState<Strategy | null>(null)
  const [editName, setEditName] = useState("")
  const [editDetail, setEditDetail] = useState("")
  const [editNote, setEditNote] = useState("")
  const [savingEdit, setSavingEdit] = useState(false)
  const [historyFor, setHistoryFor] = useState<Strategy | null>(null)
  const [revisions, setRevisions] = useState<StrategyRevision[]>([])
  const [loadingRevisions, setLoadingRevisions] = useState(false)

  const [date, setDate] = useState(todayISO)
  const [strategyId, setStrategyId] = useState<number>(0)
  const [totalPicks, setTotalPicks] = useState(0)
  const [limitUpCount, setLimitUpCount] = useState(0)
  const [failedLimitCount, setFailedLimitCount] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [conflict, setConflict] = useState<StrategyMetric | null>(null)
  const [updating, setUpdating] = useState(false)

  const empty = strategies.length === 0
  const selected = useMemo(
    () => strategies.find((s) => s.id === strategyId) ?? null,
    [strategies, strategyId]
  )

  async function refreshStrategies() {
    const list = await listStrategies()
    setStrategies(list)
    setStrategyId((prev) => (list.some((s) => s.id === prev) ? prev : 0))
  }

  useEffect(() => {
    refreshStrategies()
      .catch((err: unknown) => {
        toast.error(err instanceof Error ? err.message : "加载交易策略失败")
      })
      .finally(() => setLoading(false))
  }, [])

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    const trimmedName = name.trim()
    const trimmedDetail = detail.trim()
    if (!trimmedName) {
      toast.error("请填写交易策略名称")
      return
    }
    if (!trimmedDetail) {
      toast.error("策略内容不能为空")
      return
    }
    if (strategies.some((s) => s.name === trimmedName)) {
      toast.error("交易策略名称已存在")
      return
    }
    setCreating(true)
    try {
      await createStrategy({ name: trimmedName, current_detail: trimmedDetail })
      setName("")
      setDetail("")
      await refreshStrategies()
      toast.success("已创建交易策略")
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        toast.error("交易策略名称已存在")
      } else {
        toast.error(err instanceof Error ? err.message : "创建失败")
      }
    } finally {
      setCreating(false)
    }
  }

  function openEdit(s: Strategy) {
    setEditing(s)
    setEditName(s.name)
    setEditDetail(s.current_detail)
    setEditNote("")
  }

  async function onSaveEdit(e: FormEvent) {
    e.preventDefault()
    if (!editing) return
    const trimmedName = editName.trim()
    const trimmedDetail = editDetail.trim()
    if (!trimmedName) {
      toast.error("请填写交易策略名称")
      return
    }
    if (!trimmedDetail) {
      toast.error("策略内容不能为空")
      return
    }
    if (strategies.some((s) => s.id !== editing.id && s.name === trimmedName)) {
      toast.error("交易策略名称已存在")
      return
    }
    setSavingEdit(true)
    try {
      await updateStrategy(editing.id, {
        name: trimmedName,
        current_detail: trimmedDetail,
        note: editNote.trim(),
      })
      setEditing(null)
      await refreshStrategies()
      toast.success("已保存")
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        toast.error("交易策略名称已存在")
      } else {
        toast.error(err instanceof Error ? err.message : "保存失败")
      }
    } finally {
      setSavingEdit(false)
    }
  }

  async function openHistory(s: Strategy) {
    setHistoryFor(s)
    setLoadingRevisions(true)
    setRevisions([])
    try {
      const list = await listRevisions(s.id)
      setRevisions(list)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "加载改动记录失败")
    } finally {
      setLoadingRevisions(false)
    }
  }

  async function onConfirmDelete() {
    if (!pendingDelete) return
    setDeleting(true)
    try {
      await deleteStrategy(pendingDelete.id)
      toast.success("已删除交易策略")
      setPendingDelete(null)
      await refreshStrategies()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "删除失败")
    } finally {
      setDeleting(false)
    }
  }

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
      toast.success("已保存")
      setTotalPicks(0)
      setLimitUpCount(0)
      setFailedLimitCount(0)
    } catch (err) {
      const existing = existingMetricFromConflict(err)
      if (existing) {
        setConflict(existing)
      } else {
        toast.error(err instanceof Error ? err.message : "提交失败")
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
      toast.success("已更新")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "更新失败")
    } finally {
      setUpdating(false)
    }
  }

  function jumpToCreate() {
    document.getElementById("strategy-create")?.scrollIntoView({ behavior: "smooth", block: "start" })
    document.getElementById("strategy-name")?.focus()
  }

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <Card id="strategy-create">
        <CardHeader>
          <CardTitle>交易策略</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6">
          <form className="grid gap-4" onSubmit={onCreate}>
            <div className="grid gap-2">
              <Label htmlFor="strategy-name">名称</Label>
              <Input
                id="strategy-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="交易策略名称"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="strategy-detail">策略内容</Label>
              <Textarea
                id="strategy-detail"
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                placeholder="策略内容不可为空"
                rows={4}
              />
            </div>
            <Button type="submit" disabled={creating}>
              {creating ? "创建中..." : "新建交易策略"}
            </Button>
          </form>

          <div className="grid gap-3">
            <h3 className="text-sm font-medium">已有交易策略</h3>
            {loading ? (
              <p className="text-sm text-muted-foreground">加载中...</p>
            ) : empty ? (
              <p className="text-sm text-muted-foreground">暂无交易策略</p>
            ) : (
              <ul className="grid gap-3">
                {strategies.map((s) => (
                  <li
                    key={s.id}
                    className="flex flex-wrap items-start justify-between gap-3 rounded-lg border p-3"
                  >
                    <div className="min-w-0 flex-1 grid gap-1">
                      <div className="font-medium">{s.name}</div>
                      <p className="text-sm text-muted-foreground">{summarize(s.current_detail)}</p>
                      <p className="text-xs text-muted-foreground">
                        创建 {formatDateTime(s.created_at)} · 最后修改 {formatDateTime(s.updated_at)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => openEdit(s)}
                      >
                        编辑
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => openHistory(s)}
                      >
                        改动记录
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => setPendingDelete(s)}
                      >
                        删除
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>指标录入</CardTitle>
        </CardHeader>
        <CardContent>
          {empty ? (
            <div className="grid gap-3">
              <p className="text-sm text-muted-foreground">请先创建交易策略</p>
              <Button type="button" onClick={jumpToCreate}>
                去创建交易策略
              </Button>
              <fieldset disabled className="grid gap-4 opacity-50">
                <MetricFields
                  date={date}
                  setDate={setDate}
                  totalPicks={totalPicks}
                  setTotalPicks={setTotalPicks}
                  limitUpCount={limitUpCount}
                  setLimitUpCount={setLimitUpCount}
                  failedLimitCount={failedLimitCount}
                  setFailedLimitCount={setFailedLimitCount}
                />
                <Button type="button" disabled>
                  提交
                </Button>
              </fieldset>
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
                          {strategies.map((s) => (
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
              <MetricFields
                date={date}
                setDate={setDate}
                totalPicks={totalPicks}
                setTotalPicks={setTotalPicks}
                limitUpCount={limitUpCount}
                setLimitUpCount={setLimitUpCount}
                failedLimitCount={failedLimitCount}
                setFailedLimitCount={setFailedLimitCount}
              />
              <Button type="submit" disabled={submitting || strategyId <= 0}>
                {submitting ? "提交中..." : "提交"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={conflict !== null} onOpenChange={(open) => !open && setConflict(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>该日期已有此交易策略的记录，是否修改？</AlertDialogTitle>
            <AlertDialogDescription>
              {conflict
                ? `已有记录：筛出票数 ${conflict.total_picks}，涨停数 ${conflict.limit_up_count}，炸板数 ${conflict.failed_limit_count}。确认后将覆盖为当前表单中的数字。`
                : ""}
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

      <AlertDialog open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除交易策略</AlertDialogTitle>
            <AlertDialogDescription>
              将永久删除该策略的所有指标和改动记录
              {pendingDelete ? `（${pendingDelete.name}）` : ""}。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault()
                void onConfirmDelete()
              }}
            >
              {deleting ? "删除中..." : "确认删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>编辑交易策略</DialogTitle>
          </DialogHeader>
          <form className="grid gap-4" onSubmit={onSaveEdit}>
            <div className="grid gap-2">
              <Label htmlFor="edit-name">名称</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-detail">策略内容</Label>
              <Textarea
                id="edit-detail"
                value={editDetail}
                onChange={(e) => setEditDetail(e.target.value)}
                rows={6}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-note">本次改动说明（可选）</Label>
              <Input
                id="edit-note"
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                placeholder="仅内容变化时写入改动记录"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                取消
              </Button>
              <Button type="submit" disabled={savingEdit}>
                {savingEdit ? "保存中..." : "保存"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={historyFor !== null} onOpenChange={(open) => !open && setHistoryFor(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              改动记录{historyFor ? ` · ${historyFor.name}` : ""}
            </DialogTitle>
          </DialogHeader>
          {loadingRevisions ? (
            <p className="text-sm text-muted-foreground">加载中...</p>
          ) : revisions.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无改动记录</p>
          ) : (
            <ol className="relative grid max-h-[60vh] gap-4 overflow-auto border-l pl-4">
              {revisions.map((rev) => (
                <li key={rev.id} className="grid gap-1">
                  <div className="text-sm font-medium">{formatDateTime(rev.changed_at)}</div>
                  {rev.note ? (
                    <p className="text-sm text-muted-foreground">{rev.note}</p>
                  ) : null}
                  <details className="rounded-lg border bg-muted/30 p-2">
                    <summary className="cursor-pointer text-sm text-muted-foreground">
                      查看内容快照
                    </summary>
                    <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-xs text-foreground">
                      {rev.detail}
                    </pre>
                  </details>
                </li>
              ))}
            </ol>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function MetricFields({
  date,
  setDate,
  totalPicks,
  setTotalPicks,
  limitUpCount,
  setLimitUpCount,
  failedLimitCount,
  setFailedLimitCount,
}: {
  date: string
  setDate: (v: string) => void
  totalPicks: number
  setTotalPicks: (v: number) => void
  limitUpCount: number
  setLimitUpCount: (v: number) => void
  failedLimitCount: number
  setFailedLimitCount: (v: number) => void
}) {
  return (
    <>
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
    </>
  )
}
