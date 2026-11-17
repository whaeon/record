import { useEffect, useMemo, useState, useSyncExternalStore } from "react"
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  calendarReady,
  getCalendarVersion,
  isTradingDay,
  loadCalendar,
  subscribeCalendar,
} from "@/lib/date"

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const WEEK_HEADS = ["一", "二", "三", "四", "五", "六", "日"]
const YEARS = Array.from({ length: 9 }, (_, i) => 2020 + i)
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)

type Panel = "days" | "years" | "months"

function pad(n: number): string {
  return String(n).padStart(2, "0")
}

function toISO(y: number, m: number, d: number): string {
  return `${y}-${pad(m)}-${pad(d)}`
}

function parseISO(iso: string): { y: number; m: number; d: number } | null {
  if (!DATE_RE.test(iso)) return null
  const y = Number(iso.slice(0, 4))
  const m = Number(iso.slice(5, 7))
  const d = Number(iso.slice(8, 10))
  if (!y || m < 1 || m > 12 || d < 1 || d > 31) return null
  return { y, m, d }
}

function shortDate(iso: string): string {
  return iso.length >= 10 ? iso.slice(5) : iso
}

function monthGrid(y: number, m: number): (string | null)[] {
  const first = new Date(y, m - 1, 1)
  const last = new Date(y, m, 0).getDate()
  const start = (first.getDay() + 6) % 7
  const cells: (string | null)[] = []
  for (let i = 0; i < start; i++) cells.push(null)
  for (let d = 1; d <= last; d++) cells.push(toISO(y, m, d))
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

type DatePickerProps = {
  value: string
  onChange: (date: string) => void
  mode: "filter" | "entry"
  dates?: string[]
  tradingOnly?: boolean
  id?: string
  disabled?: boolean
  compact?: boolean
  displayValue?: string
  className?: string
}

export function DatePicker({
  value,
  onChange,
  mode,
  dates = [],
  tradingOnly,
  id,
  disabled,
  compact,
  displayValue,
  className,
}: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const parsed = parseISO(value)
  const [viewY, setViewY] = useState(parsed?.y ?? new Date().getFullYear())
  const [viewM, setViewM] = useState(parsed?.m ?? new Date().getMonth() + 1)
  const [panel, setPanel] = useState<Panel>("days")
  const [typed, setTyped] = useState("")

  useSyncExternalStore(subscribeCalendar, getCalendarVersion, getCalendarVersion)
  const calReady = calendarReady()

  useEffect(() => {
    void loadCalendar()
  }, [])

  const cells = useMemo(() => monthGrid(viewY, viewM), [viewY, viewM])
  const marked = useMemo(() => new Set(dates), [dates])

  const entryTradingOnly = tradingOnly ?? mode === "entry"

  function selectable(iso: string): boolean {
    if (mode === "entry") {
      if (entryTradingOnly && calReady && !isTradingDay(iso)) return false
      return true
    }
    return marked.has(iso)
  }

  function select(date: string) {
    if (!selectable(date)) return
    onChange(date)
    setOpen(false)
    setTyped("")
    setPanel("days")
  }

  function shiftMonth(delta: number) {
    const d = new Date(viewY, viewM - 1 + delta, 1)
    const y = d.getFullYear()
    if (y < 2020 || y > 2028) return
    setViewY(y)
    setViewM(d.getMonth() + 1)
  }

  function onOpenChange(next: boolean) {
    setOpen(next)
    if (next) {
      const p = parseISO(value)
      if (p) {
        setViewY(p.y)
        setViewM(p.m)
      }
      setTyped("")
      setPanel("days")
    }
  }

  function applyTyped() {
    const v = typed.trim()
    if (DATE_RE.test(v) && selectable(v)) select(v)
  }

  function pickYear(y: number) {
    setViewY(y)
    setPanel("months")
  }

  function pickMonth(m: number) {
    setViewM(m)
    setPanel("days")
  }

  return (
    <Popover modal open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant={compact ? "ghost" : "outline"}
          size={compact ? "sm" : "default"}
          role="combobox"
          aria-expanded={open}
          aria-label={value || "选择日期"}
          disabled={disabled}
          className={cn(
            "justify-between font-normal",
            compact
              ? "h-7 max-md:h-11 w-auto min-w-0 gap-1 px-1.5 tabular-nums"
              : "w-full min-w-0 md:min-w-40",
            className
          )}
        >
          <span className="tabular-nums">
            {displayValue ?? (compact ? shortDate(value) || "日期" : value || "选择日期")}
          </span>
          {compact ? null : <Calendar className="size-4 opacity-50" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        className="z-[70] w-72 p-2 pointer-events-auto"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            disabled={panel !== "days"}
            onClick={() => shiftMonth(-1)}
          >
            <ChevronLeft />
          </Button>
          <Button
            type="button"
            variant={panel === "years" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 min-w-0 flex-1 px-1 tabular-nums"
            aria-label="年"
            onClick={() => setPanel(panel === "years" ? "days" : "years")}
          >
            {viewY}年
          </Button>
          <Button
            type="button"
            variant={panel === "months" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 min-w-0 flex-1 px-1 tabular-nums"
            aria-label="月"
            onClick={() => setPanel(panel === "months" ? "days" : "months")}
          >
            {viewM}月
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            disabled={panel !== "days"}
            onClick={() => shiftMonth(1)}
          >
            <ChevronRight />
          </Button>
        </div>
        {panel === "years" ? (
          <div className="grid grid-cols-3 gap-1 pt-1">
            {YEARS.map((y) => (
              <button
                key={y}
                type="button"
                onClick={() => pickYear(y)}
                className={cn(
                  "h-9 rounded-md text-sm tabular-nums hover:bg-muted",
                  y === viewY && "bg-primary text-primary-foreground hover:bg-primary"
                )}
              >
                {y}
              </button>
            ))}
          </div>
        ) : null}
        {panel === "months" ? (
          <div className="grid grid-cols-3 gap-1 pt-1">
            {MONTHS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => pickMonth(m)}
                className={cn(
                  "h-9 rounded-md text-sm tabular-nums hover:bg-muted",
                  m === viewM && "bg-primary text-primary-foreground hover:bg-primary"
                )}
              >
                {m}月
              </button>
            ))}
          </div>
        ) : null}
        {panel === "days" ? (
          <>
            <div className="grid grid-cols-7 gap-0.5 pt-1 text-center text-[11px] text-muted-foreground">
              {WEEK_HEADS.map((h) => (
                <div key={h} className="py-0.5">
                  {h}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-0.5">
              {cells.map((iso, i) => {
                if (!iso) return <div key={`e-${i}`} />
                const day = Number(iso.slice(8, 10))
                const can = selectable(iso)
                const selected = iso === value
                const dotted = marked.has(iso)
                return (
                  <button
                    key={iso}
                    type="button"
                    disabled={!can}
                    onClick={() => select(iso)}
                    className={cn(
                      "relative h-8 rounded-md text-sm tabular-nums",
                      selected && "bg-primary text-primary-foreground",
                      !selected && can && "hover:bg-muted",
                      !can && "cursor-not-allowed text-muted-foreground/40"
                    )}
                  >
                    {day}
                    {dotted ? (
                      <span
                        className={cn(
                          "absolute bottom-0.5 left-1/2 size-1 -translate-x-1/2 rounded-full",
                          selected ? "bg-primary-foreground" : "bg-primary"
                        )}
                      />
                    ) : null}
                  </button>
                )
              })}
            </div>
          </>
        ) : null}
        <Input
          placeholder="YYYY-MM-DD"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              applyTyped()
            }
          }}
          onBlur={applyTyped}
          className="mt-1 h-7 text-sm tabular-nums"
        />
      </PopoverContent>
    </Popover>
  )
}
