import { useMemo, useState } from "react"
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

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

function daysOfMonth(y: number, m: number): string[] {
  const last = new Date(y, m, 0).getDate()
  const list: string[] = []
  for (let d = 1; d <= last; d++) list.push(toISO(y, m, d))
  return list
}

function shortDate(iso: string): string {
  return iso.length >= 10 ? iso.slice(5) : iso
}

type DatePickerProps = {
  value: string
  onChange: (date: string) => void
  mode: "filter" | "entry"
  dates?: string[]
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
  const [query, setQuery] = useState("")

  const monthDays = useMemo(() => daysOfMonth(viewY, viewM), [viewY, viewM])
  const filterDates = useMemo(
    () => [...dates].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0)),
    [dates]
  )

  const typed = query.trim()
  const typedValid = DATE_RE.test(typed) ? typed : ""

  function select(date: string) {
    onChange(date)
    setOpen(false)
    setQuery("")
  }

  function shiftMonth(delta: number) {
    const d = new Date(viewY, viewM - 1 + delta, 1)
    setViewY(d.getFullYear())
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
      setQuery("")
    }
  }

  const items = mode === "filter" ? filterDates : monthDays

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
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
        className={
          compact
            ? "w-56 p-0"
            : "w-[var(--radix-popover-trigger-width)] min-w-56 p-0"
        }
      >
        <Command>
          <CommandInput
            placeholder={mode === "filter" ? "搜索已有日期" : "输入日期 YYYY-MM-DD"}
            value={query}
            onValueChange={setQuery}
          />
          {mode === "entry" ? (
            <div className="flex items-center justify-between px-2 py-1.5">
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => shiftMonth(-1)}
              >
                <ChevronLeft />
              </Button>
              <span className="text-sm tabular-nums">
                {viewY}-{pad(viewM)}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => shiftMonth(1)}
              >
                <ChevronRight />
              </Button>
            </div>
          ) : null}
          <CommandList>
            <CommandEmpty>
              {mode === "filter" ? "暂无已有日期" : "无匹配日期"}
            </CommandEmpty>
            <CommandGroup>
              {mode === "entry" && typedValid && !monthDays.includes(typedValid) ? (
                <CommandItem
                  value={typedValid}
                  data-checked={typedValid === value || undefined}
                  onSelect={() => select(typedValid)}
                >
                  {typedValid}
                </CommandItem>
              ) : null}
              {items.map((d) => (
                <CommandItem
                  key={d}
                  value={d}
                  data-checked={d === value || undefined}
                  onSelect={() => select(d)}
                >
                  {d}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
