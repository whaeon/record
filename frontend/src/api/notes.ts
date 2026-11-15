import { parseJson } from "@/lib/http"

export type ReviewNote = {
  id: number
  date: string
  content: string
  updated_at: string
}

export async function listNotes(): Promise<ReviewNote[]> {
  const res = await fetch("/api/notes")
  return parseJson<ReviewNote[]>(res)
}

export async function getNote(date: string): Promise<ReviewNote> {
  const res = await fetch(`/api/notes/${date}`)
  return parseJson<ReviewNote>(res)
}

export async function saveNote(date: string, content: string): Promise<ReviewNote> {
  const res = await fetch(`/api/notes/${date}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  })
  return parseJson<ReviewNote>(res)
}
