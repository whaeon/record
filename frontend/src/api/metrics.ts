import { ApiError, parseJson } from "@/lib/http"

export type StrategyMetric = {
  id: number
  date: string
  strategy_id: number
  strategy_name: string
  total_picks: number
  limit_up_count: number
  failed_limit_count: number
  seal_rate: number
  break_rate: number
}

export type CreateMetricInput = {
  date: string
  strategy_id: number
  total_picks: number
  limit_up_count: number
  failed_limit_count: number
}

export async function listMetricDates(): Promise<string[]> {
  const res = await fetch("/api/metrics/dates")
  return parseJson<string[]>(res)
}

export async function listMetrics(params?: {
  from?: string
  to?: string
  strategy_id?: number
}): Promise<StrategyMetric[]> {
  const q = new URLSearchParams()
  if (params?.from) q.set("from", params.from)
  if (params?.to) q.set("to", params.to)
  if (params?.strategy_id) q.set("strategy_id", String(params.strategy_id))
  const qs = q.toString()
  const res = await fetch(qs ? `/api/metrics?${qs}` : "/api/metrics")
  return parseJson<StrategyMetric[]>(res)
}

export async function createMetric(input: CreateMetricInput): Promise<StrategyMetric> {
  const res = await fetch("/api/metrics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  return parseJson<StrategyMetric>(res)
}

export async function updateMetric(
  id: number,
  input: CreateMetricInput
): Promise<StrategyMetric> {
  const res = await fetch(`/api/metrics/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  return parseJson<StrategyMetric>(res)
}

export function existingMetricFromConflict(err: unknown): StrategyMetric | null {
  if (!(err instanceof ApiError) || err.status !== 409) return null
  const body = err.body
  if (!body || typeof body !== "object" || !("id" in body)) return null
  const rec = body as Partial<StrategyMetric>
  if (typeof rec.id !== "number") return null
  return rec as StrategyMetric
}
