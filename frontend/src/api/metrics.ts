export type SectorMetric = {
  id: number
  date: string
  sector_name: string
  total_picks: number
  limit_up_count: number
  failed_limit_count: number
  seal_rate: number
  break_rate: number
}

export type CreateMetricInput = {
  date: string
  sector_name: string
  total_picks: number
  limit_up_count: number
  failed_limit_count: number
}

async function readError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string }
    return body.error ?? res.statusText
  } catch {
    return res.statusText
  }
}

export async function listMetrics(params?: {
  from?: string
  to?: string
  sector?: string
}): Promise<SectorMetric[]> {
  const q = new URLSearchParams()
  if (params?.from) q.set("from", params.from)
  if (params?.to) q.set("to", params.to)
  if (params?.sector) q.set("sector", params.sector)
  const qs = q.toString()
  const res = await fetch(qs ? `/api/metrics?${qs}` : "/api/metrics")
  if (!res.ok) {
    throw new Error(await readError(res))
  }
  return res.json() as Promise<SectorMetric[]>
}

export async function createMetric(input: CreateMetricInput): Promise<SectorMetric> {
  const res = await fetch("/api/metrics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    throw new Error(await readError(res))
  }
  return res.json() as Promise<SectorMetric>
}

export function uniqueSectors(list: SectorMetric[]): string[] {
  return [...new Set(list.map((m) => m.sector_name))].sort()
}
