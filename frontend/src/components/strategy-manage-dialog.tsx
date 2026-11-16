import { useEffect, useMemo, useState, type FormEvent } from "react"
import { ClipboardList, History, Search } from "lucide-react"
import { toast } from "sonner"
import {
  createStrategy,
  deleteStrategy,
  listRevisions,
  listStrategies,
  setStrategyActive,
  updateStrategy,
  type Strategy,
  type StrategyRevision,
} from "@/api/strategies"
import { ApiError } from "@/lib/http"
import { toastApiError } from "@/lib/notify"
import { EmptyState } from "@/components/empty-state"
import { ListSkeleton } from "@/components/skeletons"
import { Button } from "@/components/ui/button"
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

export function StrategyManageDialog({
  open,
  onOpenChange,
  onChanged,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onChanged?: () => void
}) {
  const [strategies, setStrategies] = useState<Strategy[]>([])
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState("")
  const [detail, setDetail] = useState("")
  const [creating, setCreating] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<Strategy | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [strategySearch, setStrategySearch] = useState("")
  const [pendingDeactivate, setPendingDeactivate] = useState<Strategy | null>(null)
  const [toggling, setToggling] = useState(false)
  const [editing, setEditing] = useState<Strategy | null>(null)
  const [editName, setEditName] = useState("")
  const [editDetail, setEditDetail] = useState("")
  const [editNote, setEditNote] = useState("")
  const [savingEdit, setSavingEdit] = useState(false)
  const [historyFor, setHistoryFor] = useState<Strategy | null>(null)
  const [revisions, setRevisions] = useState<StrategyRevision[]>([])
  const [loadingRevisions, setLoadingRevisions] = useState(false)

  const empty = strategies.length === 0
  const filteredStrategies = useMemo(() => {
    const q = strategySearch.trim().toLowerCase()
    if (!q) return strategies
    return strategies.filter((s) => s.name.toLowerCase().includes(q))
  }, [strategies, strategySearch])

  async function refreshStrategies(notify = false) {
    const list = await listStrategies()
    setStrategies(list)
    if (notify) onChanged?.()
  }

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    listStrategies()
      .then((list) => {
        if (!cancelled) setStrategies(list)
      })
      .catch((err: unknown) => {
        if (!cancelled) toastApiError(err, "加载交易策略失败")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open])

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
      await refreshStrategies(true)
      toast.success("已创建交易策略")
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        toast.error("交易策略名称已存在")
      } else {
        toastApiError(err, "创建失败", () => void onCreate(e))
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
      await refreshStrategies(true)
      toast.success("已保存")
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        toast.error("交易策略名称已存在")
      } else {
        toastApiError(err, "保存失败")
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
      toastApiError(err, "加载改动记录失败", () => void openHistory(s))
    } finally {
      setLoadingRevisions(false)
    }
  }

  async function onConfirmDeactivate() {
    if (!pendingDeactivate) return
    setToggling(true)
    try {
      await setStrategyActive(pendingDeactivate.id, false)
      toast.success("已停用交易策略")
      setPendingDeactivate(null)
      await refreshStrategies(true)
    } catch (err) {
      toastApiError(err, "停用失败")
    } finally {
      setToggling(false)
    }
  }

  async function onActivate(s: Strategy) {
    setToggling(true)
    try {
      await setStrategyActive(s.id, true)
      toast.success("已启用交易策略")
      await refreshStrategies(true)
    } catch (err) {
      toastApiError(err, "启用失败")
    } finally {
      setToggling(false)
    }
  }

  async function onConfirmDelete() {
    if (!pendingDelete) return
    setDeleting(true)
    try {
      await deleteStrategy(pendingDelete.id)
      toast.success("已删除交易策略")
      setPendingDelete(null)
      await refreshStrategies(true)
    } catch (err) {
      toastApiError(err, "删除失败")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>管理交易策略</DialogTitle>
          </DialogHeader>
          <div className="grid gap-6">
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
                <ListSkeleton />
              ) : empty ? (
                <EmptyState
                  icon={ClipboardList}
                  title="暂无交易策略"
                  description="先创建一个交易策略，再录入每日指标。"
                />
              ) : (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="strategy-search">搜索</Label>
                    <Input
                      id="strategy-search"
                      value={strategySearch}
                      onChange={(e) => setStrategySearch(e.target.value)}
                      placeholder="按名称搜索"
                    />
                  </div>
                  {filteredStrategies.length === 0 ? (
                    <EmptyState
                      icon={Search}
                      title="未找到匹配的交易策略"
                      description="换个关键词试试，或清空搜索查看全部。"
                    />
                  ) : (
                    <ul className="grid gap-3">
                      {filteredStrategies.map((s) => (
                        <li
                          key={s.id}
                          className="flex flex-wrap items-start justify-between gap-3 rounded-lg border p-3"
                        >
                          <div className="min-w-0 flex-1 grid gap-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium">{s.name}</span>
                              {!s.is_active ? (
                                <span className="text-xs text-muted-foreground">已停用</span>
                              ) : null}
                            </div>
                            <p className="text-sm text-muted-foreground">{summarize(s.current_detail)}</p>
                            <p className="text-xs text-muted-foreground">
                              创建 {formatDateTime(s.created_at)} · 最后修改 {formatDateTime(s.updated_at)}
                            </p>
                          </div>
                          <div className="flex w-full flex-wrap gap-2 md:w-auto">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={toggling}
                              onClick={() =>
                                s.is_active ? setPendingDeactivate(s) : void onActivate(s)
                              }
                            >
                              {s.is_active ? "停用" : "启用"}
                            </Button>
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
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={pendingDeactivate !== null}
        onOpenChange={(open) => !open && setPendingDeactivate(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认停用交易策略</AlertDialogTitle>
            <AlertDialogDescription>
              历史指标保留，但不再出现在录入选项
              {pendingDeactivate ? `（${pendingDeactivate.name}）` : ""}。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={toggling}>取消</AlertDialogCancel>
            <AlertDialogAction
              disabled={toggling}
              onClick={(e) => {
                e.preventDefault()
                void onConfirmDeactivate()
              }}
            >
              {toggling ? "停用中..." : "确认停用"}
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
            <ListSkeleton rows={3} />
          ) : revisions.length === 0 ? (
            <EmptyState icon={History} title="暂无改动记录" description="修改策略内容后会在此留下版本。" />
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
    </>
  )
}
