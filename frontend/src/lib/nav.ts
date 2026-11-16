const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function parseDateParam(raw: string | null): string | null {
  if (!raw || !DATE_RE.test(raw)) return null
  return raw
}

export type StrategyFilter = "all" | number

export function parseStrategyParam(raw: string | null): StrategyFilter {
  if (!raw || raw === "all") return "all"
  const n = Number(raw)
  if (!Number.isInteger(n) || n <= 0) return "all"
  return n
}

export function strategyQuery(id: StrategyFilter): string {
  return id === "all" ? "all" : String(id)
}

export type ChartLinkParams = {
  from: string
  to: string
  strategy_id: StrategyFilter
  date?: string
}

export function chartPath(p: ChartLinkParams): string {
  const q = new URLSearchParams()
  q.set("from", p.from)
  q.set("to", p.to)
  q.set("strategy_id", strategyQuery(p.strategy_id))
  if (p.date) q.set("date", p.date)
  return `/?${q.toString()}`
}

export function notesPath(p: {
  date: string
  from: string
  to: string
  strategy_id: StrategyFilter
}): string {
  const q = new URLSearchParams()
  q.set("date", p.date)
  q.set("from", p.from)
  q.set("to", p.to)
  q.set("strategy_id", strategyQuery(p.strategy_id))
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
