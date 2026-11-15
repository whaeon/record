export type ReviewNote = {
  id: number
  date: string
  content: string
  updated_at: string
}

async function readError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string }
    return body.error ?? res.statusText
  } catch {
    return res.statusText
  }
}

export async function getNote(date: string): Promise<ReviewNote> {
  const res = await fetch(`/api/notes/${date}`)
  if (!res.ok) {
    throw new Error(await readError(res))
  }
  return res.json() as Promise<ReviewNote>
}

export async function saveNote(date: string, content: string): Promise<ReviewNote> {
  const res = await fetch(`/api/notes/${date}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  })
  if (!res.ok) {
    throw new Error(await readError(res))
  }
  return res.json() as Promise<ReviewNote>
}
