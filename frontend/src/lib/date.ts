function pad(n: number): string {
  return String(n).padStart(2, "0")
}

function toISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function parseISO(iso: string): Date {
  return new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)))
}

const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"]

export function todayISO(): string {
  return toISO(new Date())
}

export function weekdayLabel(iso: string): string {
  return WEEKDAYS[parseISO(iso).getDay()] ?? ""
}

export function monthTitle(iso: string): string {
  return `${iso.slice(0, 4)}年${Number(iso.slice(5, 7))}月`
}

export function noteDateLabel(iso: string): string {
  return `${Number(iso.slice(5, 7))}月${Number(iso.slice(8, 10))}日`
}

export function daysAgoISO(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return toISO(d)
}

export function formatPercent(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`
}

export function isTradingDay(iso: string): boolean {
  const day = parseISO(iso).getDay()
  return day !== 0 && day !== 6
}

function shiftISO(iso: string, days: number): string {
  const d = parseISO(iso)
  d.setDate(d.getDate() + days)
  return toISO(d)
}

export function lastTradingDayOnOrBefore(iso: string): string {
  let cur = iso
  while (!isTradingDay(cur)) cur = shiftISO(cur, -1)
  return cur
}

export function previousTradingDay(iso: string): string {
  return lastTradingDayOnOrBefore(shiftISO(iso, -1))
}

export function lastNTradingDays(n: number, end = todayISO()): { from: string; to: string } {
  const to = lastTradingDayOnOrBefore(end)
  let from = to
  let count = 1
  while (count < n) {
    from = shiftISO(from, -1)
    if (isTradingDay(from)) count += 1
  }
  return { from, to }
}

export function thisMonthTradingRange(today = todayISO()): { from: string; to: string } {
  const to = lastTradingDayOnOrBefore(today)
  const month = today.slice(0, 7)
  let from = `${month}-01`
  while (!isTradingDay(from) && from.slice(0, 7) === month) from = shiftISO(from, 1)
  return { from, to }
}

export type RangePreset = "5" | "20" | "month" | "all"

export function matchRangePreset(
  from: string,
  to: string,
  existingDates: string[]
): RangePreset | null {
  const last5 = lastNTradingDays(5)
  if (from === last5.from && to === last5.to) return "5"
  const last20 = lastNTradingDays(20)
  if (from === last20.from && to === last20.to) return "20"
  const month = thisMonthTradingRange()
  if (from === month.from && to === month.to) return "month"
  if (existingDates.length > 0) {
    const allFrom = existingDates[0]
    const allTo = existingDates[existingDates.length - 1]
    if (from === allFrom && to === allTo) return "all"
  }
  return null
}
