const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function parseDateParam(raw: string | null): string | null {
  if (!raw || !DATE_RE.test(raw)) return null
  return raw
}

export function parseStrategyParam(raw: string | null): number {
  if (!raw) return 0
  const n = Number(raw)
  if (!Number.isInteger(n) || n <= 0) return 0
  return n
}

export type ChartLinkParams = {
  from: string
  to: string
  strategy_id: number
  date?: string
}

export function chartPath(p: ChartLinkParams): string {
  const q = new URLSearchParams()
  q.set("from", p.from)
  q.set("to", p.to)
  if (p.strategy_id > 0) q.set("strategy_id", String(p.strategy_id))
  if (p.date) q.set("date", p.date)
  return `/chart?${q.toString()}`
}

export function notesPath(p: {
  date: string
  from: string
  to: string
  strategy_id: number
}): string {
  const q = new URLSearchParams()
  q.set("date", p.date)
  q.set("from", p.from)
  q.set("to", p.to)
  if (p.strategy_id > 0) q.set("strategy_id", String(p.strategy_id))
  return `/notes?${q.toString()}`
}

export function ensureRange(
  from: string,
  to: string,
  date: string
): { from: string; to: string } {
  return {
    from: date < from ? date : from,
    to: date > to ? date : to,
  }
}
