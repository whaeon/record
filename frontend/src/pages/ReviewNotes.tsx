import { useEffect, useRef, useState } from "react"
import Markdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Menu, Plus } from "lucide-react"
import { getNote, listNotes, saveNote, type ReviewNote } from "@/api/notes"
import { todayISO } from "@/lib/date"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

const markdownPlugins = [remarkGfm]
const disallowedElements = [
  "img",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
]

function summarize(text: string, max = 50): string {
  const t = text.replace(/\s+/g, " ").trim()
  if (!t) return "（空）"
  if (t.length <= max) return t
  return `${t.slice(0, max)}...`
}

export default function ReviewNotes() {
  const [date, setDate] = useState(todayISO)
  const [content, setContent] = useState("")
  const [notes, setNotes] = useState<ReviewNote[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [drawerOpen, setDrawerOpen] = useState(false)
  const hideTimer = useRef<number>(0)

  function refreshNotes() {
    listNotes()
      .then(setNotes)
      .catch(() => {})
  }

  useEffect(() => {
    refreshNotes()
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError("")
    setMessage("")
    getNote(date)
      .then((note) => {
        if (!cancelled) setContent(note.content)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "加载失败")
          setContent("")
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [date])

  useEffect(() => {
    return () => {
      if (hideTimer.current) window.clearTimeout(hideTimer.current)
    }
  }, [])

  function selectDate(next: string) {
    setDate(next)
    setDrawerOpen(false)
  }

  function onNewNote() {
    selectDate(todayISO())
  }

  async function onSave() {
    setError("")
    setMessage("")
    setSaving(true)
    try {
      await saveNote(date, content)
      setMessage("已保存")
      refreshNotes()
      if (hideTimer.current) window.clearTimeout(hideTimer.current)
      hideTimer.current = window.setTimeout(() => setMessage(""), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败")
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
    />
  )

  return (
    <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="hidden min-h-[480px] rounded-xl border bg-card text-card-foreground lg:block">
        {listPanel}
      </aside>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-end justify-between gap-4">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="lg:hidden"
              onClick={() => setDrawerOpen(true)}
            >
              <Menu />
              <span className="sr-only">打开复盘列表</span>
            </Button>
            <CardTitle>复盘记录 {date}</CardTitle>
          </div>
          <Button type="button" onClick={onSave} disabled={saving || loading}>
            {saving ? "保存中..." : "保存"}
          </Button>
        </CardHeader>
        <CardContent>
          {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}
          {message ? <p className="mb-3 text-sm text-muted-foreground">{message}</p> : null}
          {loading ? (
            <p className="text-sm text-muted-foreground">加载中...</p>
          ) : (
            <div className="grid min-h-[480px] gap-4 md:grid-cols-2">
              <textarea
                className="h-[480px] w-full resize-none rounded-lg border border-input bg-transparent p-3 font-mono text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={"支持标题、加粗、斜体、列表、引用、代码与链接"}
                spellCheck={false}
              />
              <div className="h-[480px] overflow-auto rounded-lg border bg-background p-3">
                <div className="prose prose-neutral dark:prose-invert max-w-none">
                  <Markdown
                    remarkPlugins={markdownPlugins}
                    skipHtml
                    disallowedElements={disallowedElements}
                    unwrapDisallowed
                  >
                    {content}
                  </Markdown>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="left" className="p-0 lg:hidden">
          <SheetHeader className="sr-only">
            <SheetTitle>复盘记录列表</SheetTitle>
          </SheetHeader>
          {listPanel}
        </SheetContent>
      </Sheet>
    </div>
  )
}

function NoteList({
  notes,
  selectedDate,
  onSelect,
  onNew,
}: {
  notes: ReviewNote[]
  selectedDate: string
  onSelect: (date: string) => void
  onNew: () => void
}) {
  return (
    <div className="flex h-full min-h-[480px] flex-col">
      <div className="flex items-center justify-between gap-2 border-b p-3">
        <span className="text-sm font-medium">已有记录</span>
        <Button type="button" size="sm" onClick={onNew}>
          <Plus />
          新建复盘
        </Button>
      </div>
      <ul className="flex-1 overflow-auto p-2">
        {notes.length === 0 ? (
          <li className="px-2 py-6 text-center text-sm text-muted-foreground">暂无复盘记录</li>
        ) : (
          notes.map((n) => {
            const active = n.date === selectedDate
            return (
              <li key={n.date}>
                <button
                  type="button"
                  onClick={() => onSelect(n.date)}
                  className={[
                    "mb-1 w-full rounded-lg border px-3 py-2 text-left",
                    active
                      ? "border-ring bg-muted text-foreground"
                      : "border-transparent hover:bg-muted/60",
                  ].join(" ")}
                >
                  <div className="text-sm font-medium">{n.date}</div>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                    {summarize(n.content)}
                  </p>
                </button>
              </li>
            )
          })
        )}
      </ul>
    </div>
  )
}
