import { useEffect, useRef, useState } from "react"
import Markdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { getNote, saveNote } from "@/api/notes"
import { todayISO } from "@/lib/date"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

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

export default function ReviewNotes() {
  const [date, setDate] = useState(todayISO)
  const [content, setContent] = useState("")
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const hideTimer = useRef<number>(0)

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

  async function onSave() {
    setError("")
    setMessage("")
    setSaving(true)
    try {
      await saveNote(date, content)
      setMessage("已保存")
      if (hideTimer.current) window.clearTimeout(hideTimer.current)
      hideTimer.current = window.setTimeout(() => setMessage(""), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-end justify-between gap-4">
        <CardTitle>复盘记录</CardTitle>
        <div className="flex flex-wrap items-end gap-3">
          <div className="grid gap-2">
            <Label htmlFor="note-date">日期</Label>
            <Input
              id="note-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <Button type="button" onClick={onSave} disabled={saving || loading}>
            {saving ? "保存中..." : "保存"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}
        {message ? <p className="mb-3 text-sm text-muted-foreground">{message}</p> : null}
        {loading ? (
          <p className="text-sm text-muted-foreground">加载中...</p>
        ) : (
          <div className="grid min-h-[480px] gap-4 md:grid-cols-2">
            <textarea
              className="h-[480px] w-full resize-none rounded-lg border border-input bg-transparent p-3 font-mono text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={"支持标题、加粗、斜体、列表、引用、代码与链接"}
              spellCheck={false}
            />
            <div className="h-[480px] overflow-auto rounded-lg border p-3">
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
  )
}
