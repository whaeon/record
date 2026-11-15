import { ApiError, parseJson, readError } from "@/lib/http"

export type Strategy = {
  id: number
  name: string
  current_detail: string
  created_at: string
  updated_at: string
}

export async function listStrategies(): Promise<Strategy[]> {
  const res = await fetch("/api/strategies")
  return parseJson<Strategy[]>(res)
}

export async function createStrategy(input: {
  name: string
  current_detail: string
}): Promise<Strategy> {
  const res = await fetch("/api/strategies", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  return parseJson<Strategy>(res)
}

export async function deleteStrategy(id: number): Promise<void> {
  const res = await fetch(`/api/strategies/${id}?confirm=true`, {
    method: "DELETE",
  })
  if (!res.ok) {
    throw new ApiError(res.status, await readError(res))
  }
}
