import { apiFetch, parseJson } from "@/lib/http"

export type CalendarDay = {
  date: string
  is_trading_day: boolean
}

export async function listCalendar(from?: string, to?: string): Promise<CalendarDay[]> {
  const q = new URLSearchParams()
  if (from) q.set("from", from)
  if (to) q.set("to", to)
  const qs = q.toString()
  const res = await apiFetch(qs ? `/api/calendar?${qs}` : "/api/calendar")
  return parseJson<CalendarDay[]>(res)
}
