import { ApiError, parseJson, readError } from "@/lib/http"

export type Strategy = {
  id: number
  name: string
  current_detail: string
  is_active: boolean
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

export type StrategyRevision = {
  id: number
  strategy_id: number
  detail: string
  note: string
  changed_at: string
}

export async function setStrategyActive(id: number, is_active: boolean): Promise<Strategy> {
  const res = await fetch(`/api/strategies/${id}/active`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ is_active }),
  })
  return parseJson<Strategy>(res)
}

export async function updateStrategy(
  id: number,
  input: { name: string; current_detail: string; note?: string }
): Promise<Strategy> {
  const res = await fetch(`/api/strategies/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  return parseJson<Strategy>(res)
}

export async function listRevisions(id: number): Promise<StrategyRevision[]> {
  const res = await fetch(`/api/strategies/${id}/revisions`)
  return parseJson<StrategyRevision[]>(res)
}
