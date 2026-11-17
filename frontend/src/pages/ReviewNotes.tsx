import {
  createElement,
  useEffect,
  useMemo,
  useRef,
  useState,
  type JSX,
} from "react"
import { toast } from "sonner"
import { useNavigate, useSearchParams } from "react-router-dom"
import Markdown, { type Components } from "react-markdown"
import remarkBreaks from "remark-breaks"
import remarkGfm from "remark-gfm"
import {
  Bold,
  Heading2,
  Italic,
  List,
  NotebookPen,
  Plus,
  Quote,
  Search,
} from "lucide-react"
import { listMetrics, type StrategyMetric } from "@/api/metrics"
import { getNote, listNotes, saveNote, type ReviewNote } from "@/api/notes"
import { DatePicker } from "@/components/date-picker"
import {
  daysAgoISO,
  formatPercent,
  monthTitle,
  noteDateLabel,
  todayISO,
  weekdayLabel,
} from "@/lib/date"
import { toastApiError } from "@/lib/notify"
import { EmptyState } from "@/components/empty-state"
import { EditorSkeleton, ListSkeleton } from "@/components/skeletons"
import {
  chartPath,
  ensureRange,
  parseDateParam,
  parseStrategyParam,
  strategyQuery,
} from "@/lib/nav"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const markdownPlugins = [remarkGfm, remarkBreaks]
const SYNC_KEY = "notes.previewSync"
const SYNC_CLASS = ["rounded-sm", "bg-muted/70"] as const

function sourceLineFromNode(node: unknown): number | undefined {
  if (!node || typeof node !== "object" || !("position" in node)) return undefined
  const line = (node as { position?: { start?: { line?: number } } }).position?.start?.line
  return typeof line === "number" ? line - 1 : undefined
}

function markdownSource(tag: keyof JSX.IntrinsicElements) {
  return function MarkdownSourceEl({
    node,
    ...props
  }: JSX.IntrinsicElements[typeof tag] & { node?: unknown }) {
    return createElement(tag, {
      ...props,
      "data-source-line": sourceLineFromNode(node),
    })
  }
}

const previewComponents: Components = {
  p: markdownSource("p"),
  h1: markdownSource("h1"),
  h2: markdownSource("h2"),
  h3: markdownSource("h3"),
  h4: markdownSource("h4"),
  h5: markdownSource("h5"),
  h6: markdownSource("h6"),
  li: markdownSource("li"),
  blockquote: markdownSource("blockquote"),
  pre: markdownSource("pre"),
}

function findPreviewBlock(root: HTMLElement, line: number): HTMLElement | null {
  const nodes = root.querySelectorAll<HTMLElement>("[data-source-line]")
  let best: HTMLElement | null = null
  let bestLine = -1
  for (const n of nodes) {
    const raw = n.getAttribute("data-source-line")
    if (raw == null || raw === "") continue
    const v = Number(raw)
    if (!Number.isFinite(v) || v > line || v < bestLine) continue
    best = n
    bestLine = v
  }
  return best
}
const disallowedElements = [
  "img",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
]

type MobilePane = "list" | "edit" | "preview"

function summarize(text: string, max = 50): string {
  const t = text.replace(/\s+/g, " ").trim()
  if (!t) return "（空）"
  if (t.length <= max) return t
  return `${t.slice(0, max)}...`
}

function summarizeMetrics(rows: StrategyMetric[]): {
  total_picks: number
  limit_up_count: number
  seal_rate: number
  break_rate: number
} | null {
  if (rows.length === 0) return null
  const total_picks = rows.reduce((s, r) => s + r.total_picks, 0)
  const limit_up_count = rows.reduce((s, r) => s + r.limit_up_count, 0)
  const failed_limit_count = rows.reduce((s, r) => s + r.failed_limit_count, 0)
  const touch = limit_up_count + failed_limit_count
  return {
    total_picks,
    limit_up_count,
    seal_rate: touch > 0 ? limit_up_count / touch : 0,
    break_rate: touch > 0 ? failed_limit_count / touch : 0,
  }
}

function applyWrap(
  el: HTMLTextAreaElement,
  value: string,
  setValue: (next: string) => void,
  before: string,
  after: string,
  placeholder: string
) {
  const start = el.selectionStart
  const end = el.selectionEnd
  const selected = value.slice(start, end) || placeholder
  const next = value.slice(0, start) + before + selected + after + value.slice(end)
  const from = start + before.length
  setValue(next)
  requestAnimationFrame(() => {
    el.focus()
    el.setSelectionRange(from, from + selected.length)
  })
}

function applyLinePrefix(
  el: HTMLTextAreaElement,
  value: string,
  setValue: (next: string) => void,
  prefix: string
) {
  const start = el.selectionStart
  const end = el.selectionEnd
  const lineStart = value.lastIndexOf("\n", start - 1) + 1
  const lineEndIdx = value.indexOf("\n", end)
  const lineEnd = lineEndIdx === -1 ? value.length : lineEndIdx
  const block = value.slice(lineStart, lineEnd)
  const lines = block.split("\n").map((line) => (line.startsWith(prefix) ? line : prefix + line))
  const replaced = lines.join("\n")
  const next = value.slice(0, lineStart) + replaced + value.slice(lineEnd)
  setValue(next)
  requestAnimationFrame(() => {
    el.focus()
    el.setSelectionRange(lineStart, lineStart + replaced.length)
  })
}

export default function ReviewNotes() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const date = parseDateParam(searchParams.get("date")) ?? todayISO()
  const from = parseDateParam(searchParams.get("from")) ?? daysAgoISO(30)
  const to = parseDateParam(searchParams.get("to")) ?? todayISO()
  const strategyId = parseStrategyParam(searchParams.get("strategy_id"))
  const [content, setContent] = useState("")
  const [notes, setNotes] = useState<ReviewNote[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [listLoading, setListLoading] = useState(true)
  const [noteTick, setNoteTick] = useState(0)
  const [mobilePane, setMobilePane] = useState<MobilePane>("preview")
  const [editing, setEditing] = useState(false)
  const [newOpen, setNewOpen] = useState(false)
  const [newDate, setNewDate] = useState(todayISO)
  const [dayMetrics, setDayMetrics] = useState<StrategyMetric[]>([])
  const [syncPreview, setSyncPreview] = useState(() => {
    try {
      return localStorage.getItem(SYNC_KEY) === "1"
    } catch {
      return false
    }
  })
  const [cursorLine, setCursorLine] = useState(0)
  const editorRef = useRef<HTMLTextAreaElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const syncElRef = useRef<HTMLElement | null>(null)

  function persistSync(next: boolean) {
    setSyncPreview(next)
    try {
      localStorage.setItem(SYNC_KEY, next ? "1" : "0")
    } catch {
      return
    }
  }

  function lineAtCursor(el: HTMLTextAreaElement): number {
    return el.value.slice(0, el.selectionStart).split("\n").length - 1
  }

  function updateCursorLine(el: HTMLTextAreaElement) {
    setCursorLine(lineAtCursor(el))
  }

  useEffect(() => {
    const prev = syncElRef.current
    if (prev) {
      prev.classList.remove(...SYNC_CLASS)
      syncElRef.current = null
    }
    if (!syncPreview || !editing) return
    const root = previewRef.current
    if (!root) return
    const target = findPreviewBlock(root, cursorLine)
    if (!target) return
    target.classList.add(...SYNC_CLASS)
    syncElRef.current = target
    const rootRect = root.getBoundingClientRect()
    const tRect = target.getBoundingClientRect()
    if (tRect.top < rootRect.top || tRect.bottom > rootRect.bottom) {
      target.scrollIntoView({ block: "nearest" })
    }
  }, [syncPreview, cursorLine, content, editing])

  function patchDate(next: string) {
    const q = new URLSearchParams(searchParams)
    q.set("date", next)
    q.set("from", from)
    q.set("to", to)
    q.set("strategy_id", strategyQuery(strategyId))
    setSearchParams(q, { replace: true })
  }

  function refreshNotes() {
    setListLoading(true)
    listNotes()
      .then(setNotes)
      .catch((err: unknown) => {
        toastApiError(err, "加载复盘列表失败", () => refreshNotes())
      })
      .finally(() => setListLoading(false))
  }

  useEffect(() => {
    refreshNotes()
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getNote(date)
      .then((note) => {
        if (!cancelled) setContent(note.content)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          toastApiError(err, "加载失败", () => setNoteTick((n) => n + 1))
          setContent("")
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [date, noteTick])

  useEffect(() => {
    let cancelled = false
    listMetrics({
      from: date,
      to: date,
      strategy_id: strategyId,
    })
      .then((list) => {
        if (!cancelled) setDayMetrics(list)
      })
      .catch(() => {
        if (!cancelled) setDayMetrics([])
      })
    return () => {
      cancelled = true
    }
  }, [date, strategyId])

  const summary = useMemo(() => summarizeMetrics(dayMetrics), [dayMetrics])
  const empty = !content.trim()

  function selectDate(next: string) {
    patchDate(next)
    setEditing(false)
    setMobilePane("preview")
  }

  function startEditing() {
    setEditing(true)
    setMobilePane("edit")
  }

  function onNewNote() {
    setNewDate(todayISO())
    setNewOpen(true)
  }

  function confirmNewNote() {
    patchDate(newDate)
    setEditing(true)
    setMobilePane("edit")
    setNewOpen(false)
  }

  function goToChart() {
    const range = ensureRange(from, to, date)
    navigate(chartPath({ ...range, strategy_id: strategyId, date }))
  }

  async function onSave() {
    setSaving(true)
    try {
      await saveNote(date, content)
      toast.success("已保存")
      refreshNotes()
      setEditing(false)
      setMobilePane("preview")
    } catch (err) {
      toastApiError(err, "保存失败", () => void onSave())
    } finally {
      setSaving(false)
    }
  }

  const listPanel = (
    <NoteList
      notes={notes}
      selectedDate={date}
      onSelect={selectDate}
      onNew={onNewNote}
      loading={listLoading}
    />
  )

  function withEditor(
    fn: (el: HTMLTextAreaElement) => void
  ) {
    const el = editorRef.current
    if (el) fn(el)
  }

  function renderEditor() {
    return (
      <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border">
        <div className="flex shrink-0 flex-wrap items-center gap-1 border-b bg-muted/40 px-2 py-1.5">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            title="标题"
            aria-label="标题"
            onClick={() =>
              withEditor((el) => applyLinePrefix(el, content, setContent, "## "))
            }
          >
            <Heading2 />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            title="粗体"
            aria-label="粗体"
            onClick={() =>
              withEditor((el) => applyWrap(el, content, setContent, "**", "**", "粗体"))
            }
          >
            <Bold />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            title="斜体"
            aria-label="斜体"
            onClick={() =>
              withEditor((el) => applyWrap(el, content, setContent, "*", "*", "斜体"))
            }
          >
            <Italic />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            title="列表"
            aria-label="列表"
            onClick={() =>
              withEditor((el) => applyLinePrefix(el, content, setContent, "- "))
            }
          >
            <List />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            title="引用"
            aria-label="引用"
            onClick={() =>
              withEditor((el) => applyLinePrefix(el, content, setContent, "> "))
            }
          >
            <Quote />
          </Button>
          <span className="hidden text-xs text-muted-foreground sm:inline">
            回车换行，空一行分段
          </span>
          <button
            type="button"
            aria-pressed={syncPreview}
            title="光标所在行同步滚动预览"
            onClick={() => persistSync(!syncPreview)}
            className={[
              "ml-auto hidden h-6 items-center rounded-md px-2 text-xs md:inline-flex",
              syncPreview
                ? "bg-muted font-medium text-foreground"
                : "text-muted-foreground hover:bg-muted/60",
            ].join(" ")}
          >
            同步预览
          </button>
        </div>
        <textarea
          ref={editorRef}
          className="min-h-0 w-full flex-1 resize-none overflow-auto bg-transparent p-3 font-sans text-sm leading-7 text-foreground outline-none placeholder:text-muted-foreground dark:bg-input/30"
          value={content}
          onChange={(e) => {
            setContent(e.target.value)
            updateCursorLine(e.currentTarget)
          }}
          onClick={(e) => updateCursorLine(e.currentTarget)}
          onKeyUp={(e) => updateCursorLine(e.currentTarget)}
          onSelect={(e) => updateCursorLine(e.currentTarget)}
          onKeyDown={(e) => {
            if (!(e.metaKey || e.ctrlKey)) return
            const el = e.currentTarget
            if (e.key === "b") {
              e.preventDefault()
              applyWrap(el, content, setContent, "**", "**", "粗体")
            }
            if (e.key === "i") {
              e.preventDefault()
              applyWrap(el, content, setContent, "*", "*", "斜体")
            }
          }}
          placeholder={"写今日复盘，点上方按钮即可加标题、加粗或列表。"}
          spellCheck={false}
        />
      </div>
    )
  }

  function renderPreview() {
    return (
      <div ref={previewRef} className="h-full min-h-0 overflow-auto rounded-lg border bg-background p-3">
        <div className="prose prose-neutral dark:prose-invert max-w-none text-sm leading-7 [&_p]:my-2 [&_p:first-child]:mt-0 [&_li_p]:my-0">
          <Markdown
            remarkPlugins={markdownPlugins}
            skipHtml
            disallowedElements={disallowedElements}
            unwrapDisallowed
            components={previewComponents}
          >
            {content}
          </Markdown>
        </div>
      </div>
    )
  }

  function renderEmpty() {
    return (
      <div className="flex h-full min-h-0 items-center justify-center">
        <EmptyState
          icon={NotebookPen}
          title="这一天还没有复盘"
          description="开始编写后，这里会显示 Markdown 预览。"
          action={
            <Button type="button" size="sm" onClick={startEditing}>
              开始编写
            </Button>
          }
        />
      </div>
    )
  }

  function onMobilePane(key: MobilePane) {
    if (key === "edit") {
      startEditing()
      return
    }
    setMobilePane(key)
  }

  return (
    <div className="grid min-h-0 flex-1 overflow-hidden gap-4 md:grid-cols-[18rem_minmax(0,1fr)]">
      <aside className="hidden min-h-0 rounded-xl border bg-card text-card-foreground md:flex md:flex-col">
        {listPanel}
      </aside>

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <CardHeader className="flex shrink-0 flex-row flex-wrap items-end justify-between gap-4">
          <CardTitle>
            {date} {weekdayLabel(date)}
          </CardTitle>
          <div className="flex items-center gap-2">
            {editing ? (
              <Button type="button" onClick={onSave} disabled={saving || loading}>
                {saving ? "保存中..." : "保存"}
              </Button>
            ) : empty ? null : (
              <Button type="button" variant="outline" onClick={startEditing} disabled={loading}>
                编辑
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <button
            type="button"
            onClick={goToChart}
            className="mb-3 grid w-full min-h-11 shrink-0 gap-1 rounded-lg border p-3 text-left hover:bg-muted/50"
          >
            {summary ? (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm md:grid-cols-4">
                <div className="flex justify-between gap-2 md:block">
                  <dt className="text-muted-foreground">涨停数</dt>
                  <dd className="tabular-nums font-medium">{summary.limit_up_count}</dd>
                </div>
                <div className="flex justify-between gap-2 md:block">
                  <dt className="text-muted-foreground">筛出数</dt>
                  <dd className="tabular-nums font-medium">{summary.total_picks}</dd>
                </div>
                <div className="flex justify-between gap-2 md:block">
                  <dt className="text-muted-foreground">封板率</dt>
                  <dd className="tabular-nums font-medium">{formatPercent(summary.seal_rate)}</dd>
                </div>
                <div className="flex justify-between gap-2 md:block">
                  <dt className="text-muted-foreground">炸板率</dt>
                  <dd className="tabular-nums font-medium">{formatPercent(summary.break_rate)}</dd>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">该日暂无指标，点击返回图表</p>
            )}
          </button>
          {loading ? (
            <EditorSkeleton />
          ) : (
            <>
              <div className="mb-3 grid shrink-0 grid-cols-3 gap-1 rounded-lg border p-1 md:hidden">
                {(
                  [
                    ["list", "列表"],
                    ["edit", "编辑"],
                    ["preview", "预览"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onMobilePane(key)}
                    className={[
                      "inline-flex min-h-11 items-center justify-center rounded-md text-sm",
                      mobilePane === key
                        ? "bg-muted font-medium text-foreground"
                        : "text-muted-foreground",
                    ].join(" ")}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex min-h-0 flex-1 flex-col md:hidden">
                {mobilePane === "list" ? (
                  <div className="h-full min-h-0 overflow-hidden rounded-lg border">{listPanel}</div>
                ) : null}
                {mobilePane === "edit" ? renderEditor() : null}
                {mobilePane === "preview"
                  ? empty && !editing
                    ? renderEmpty()
                    : renderPreview()
                  : null}
              </div>
              <div className="hidden min-h-0 flex-1 flex-col md:flex">
                {editing ? (
                  <div className="grid min-h-0 flex-1 grid-rows-2 gap-3">
                    {renderPreview()}
                    {renderEditor()}
                  </div>
                ) : empty ? (
                  renderEmpty()
                ) : (
                  renderPreview()
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建复盘</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="new-note-date">日期</Label>
            <DatePicker
              id="new-note-date"
              mode="entry"
              tradingOnly={false}
              value={newDate}
              onChange={setNewDate}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setNewOpen(false)}>
              取消
            </Button>
            <Button type="button" onClick={confirmNewNote}>
              开始编写
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function NoteList({
  notes,
  selectedDate,
  onSelect,
  onNew,
  loading,
}: {
  notes: ReviewNote[]
  selectedDate: string
  onSelect: (date: string) => void
  onNew: () => void
  loading?: boolean
}) {
  const [query, setQuery] = useState("")
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return notes
    return notes.filter((n) => {
      const weekday = weekdayLabel(n.date)
      return (
        n.date.includes(q) ||
        noteDateLabel(n.date).includes(q) ||
        weekday.includes(q) ||
        n.content.toLowerCase().includes(q)
      )
    })
  }, [notes, query])

  const groups = useMemo(() => {
    const map = new Map<string, ReviewNote[]>()
    for (const n of filtered) {
      const key = n.date.slice(0, 7)
      const list = map.get(key)
      if (list) list.push(n)
      else map.set(key, [n])
    }
    return [...map.entries()]
  }, [filtered])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b p-3">
        <span className="text-sm font-medium">已有记录</span>
        <Button type="button" size="sm" onClick={onNew}>
          <Plus />
          新建复盘
        </Button>
      </div>
      <div className="relative shrink-0 border-b p-2">
        <Search className="pointer-events-none absolute top-1/2 left-4 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索日期或正文"
          className="pl-8"
          aria-label="搜索复盘"
        />
      </div>
      <ul className="min-h-0 flex-1 overflow-auto p-2">
        {loading ? (
          <li>
            <ListSkeleton rows={5} />
          </li>
        ) : notes.length === 0 ? (
          <li>
            <EmptyState
              icon={NotebookPen}
              title="暂无复盘记录"
              description="点击新建，开始写下当日复盘。"
              action={
                <Button type="button" size="sm" onClick={onNew}>
                  新建复盘
                </Button>
              }
            />
          </li>
        ) : filtered.length === 0 ? (
          <li>
            <EmptyState
              icon={Search}
              title="没有匹配的记录"
              description="换个日期或关键词再试。"
            />
          </li>
        ) : (
          groups.map(([month, items]) => (
            <li key={month} className="mb-2">
              <div className="sticky top-0 z-10 bg-card px-2 py-1.5 text-xs font-medium text-muted-foreground">
                {monthTitle(`${month}-01`)}
              </div>
              <ul>
                {items.map((n) => {
                  const active = n.date === selectedDate
                  const weekday = weekdayLabel(n.date)
                  const weekend = weekday === "周六" || weekday === "周日"
                  return (
                    <li key={n.date}>
                      <button
                        type="button"
                        onClick={() => onSelect(n.date)}
                        className={[
                          "mb-1 flex min-h-11 w-full flex-col justify-center rounded-lg border px-3 py-2 text-left",
                          active
                            ? "border-ring bg-muted text-foreground"
                            : "border-transparent hover:bg-muted/60",
                        ].join(" ")}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium tabular-nums">
                            {noteDateLabel(n.date)}
                          </span>
                          <span
                            className={[
                              "rounded-md px-1.5 py-0.5 text-[11px] leading-none",
                              weekend
                                ? "bg-muted text-muted-foreground"
                                : "bg-primary/10 text-foreground",
                            ].join(" ")}
                          >
                            {weekday}
                          </span>
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                          {summarize(n.content)}
                        </p>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </li>
          ))
        )}
      </ul>
    </div>
  )
}
