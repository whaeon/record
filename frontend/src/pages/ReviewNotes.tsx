import { useEffect, useRef, useState } from "react"
import Markdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Plus } from "lucide-react"
import { getNote, listNotes, saveNote, type ReviewNote } from "@/api/notes"
import { todayISO } from "@/lib/date"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

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

type MobilePane = "list" | "edit" | "preview"

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
  const [mobilePane, setMobilePane] = useState<MobilePane>("edit")
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
    setMobilePane("edit")
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

  function renderEditor() {
    return (
      <textarea
        className="h-[min(60vh,28rem)] w-full resize-none rounded-lg border border-input bg-transparent p-3 font-mono text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:h-[480px] dark:bg-input/30"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={"支持标题、加粗、斜体、列表、引用、代码与链接"}
        spellCheck={false}
      />
    )
  }

  function renderPreview() {
    return (
      <div className="h-[min(60vh,28rem)] overflow-auto rounded-lg border bg-background p-3 md:h-[480px]">
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
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="hidden min-h-[480px] rounded-xl border bg-card text-card-foreground md:block">
        {listPanel}
      </aside>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-end justify-between gap-4">
          <CardTitle>复盘记录 {date}</CardTitle>
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
            <>
              <div className="mb-3 grid grid-cols-3 gap-1 rounded-lg border p-1 md:hidden">
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
                    onClick={() => setMobilePane(key)}
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
              <div className="md:hidden">
                {mobilePane === "list" ? (
                  <div className="rounded-lg border">{listPanel}</div>
                ) : null}
                {mobilePane === "edit" ? renderEditor() : null}
                {mobilePane === "preview" ? renderPreview() : null}
              </div>
              <div className="hidden min-h-[480px] gap-4 md:grid md:grid-cols-2">
                {renderEditor()}
                {renderPreview()}
              </div>
            </>
          )}
        </CardContent>
      </Card>
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
    <div className="flex h-full min-h-[320px] flex-col md:min-h-[480px]">
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
                    "mb-1 flex min-h-11 w-full flex-col justify-center rounded-lg border px-3 py-2 text-left",
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
