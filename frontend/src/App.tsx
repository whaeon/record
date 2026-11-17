import { useEffect, useState } from "react"
import { NavLink, Navigate, Route, Routes, useLocation } from "react-router-dom"
import { LineChart, LogOut, Menu, NotebookPen } from "lucide-react"
import { getMe, logout, type Me } from "@/api/auth"
import { ConnectionBanner } from "@/components/connection-banner"
import { ExportMenu } from "@/components/export-menu"
import { ThemeToggle } from "@/components/theme-toggle"
import { Toaster } from "@/components/ui/sonner"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { subscribeUnauthorized } from "@/lib/http"
import { loadCalendar } from "@/lib/date"
import MetricsChart from "@/pages/MetricsChart"
import { Login } from "@/pages/Login"
import ReviewNotes from "@/pages/ReviewNotes"

const navItems = [
  { to: "/", label: "策略回顾", icon: LineChart, end: true },
  { to: "/notes", label: "复盘记录", icon: NotebookPen, end: false },
] as const

function ChartRedirect() {
  const { search } = useLocation()
  return <Navigate to={{ pathname: "/", search }} replace />
}

function App() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [me, setMe] = useState<Me | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [calReady, setCalReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    getMe()
      .then((user) => {
        if (!cancelled) setMe(user)
      })
      .catch(() => {
        if (!cancelled) setMe(null)
      })
      .finally(() => {
        if (!cancelled) setAuthReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => subscribeUnauthorized(() => setMe(null)), [])

  useEffect(() => {
    if (!me) return
    let cancelled = false
    loadCalendar()
      .then(() => {
        if (!cancelled) setCalReady(true)
      })
      .catch(() => {
        if (!cancelled) setCalReady(false)
      })
    return () => {
      cancelled = true
    }
  }, [me])

  async function onLogout() {
    try {
      await logout()
    } finally {
      setMe(null)
    }
  }

  if (!authReady) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background text-muted-foreground">
        加载中…
      </div>
    )
  }

  if (!me) {
    return (
      <>
        <Login onSuccess={setMe} />
        <Toaster />
      </>
    )
  }

  if (!calReady) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background text-muted-foreground">
        加载中…
      </div>
    )
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      <header className="shrink-0 border-b bg-background">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 md:grid md:grid-cols-3 md:px-6">
          <span className="justify-self-start font-medium">交易复盘</span>
          <nav className="hidden items-center justify-center gap-6 text-sm md:flex">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  [
                    "inline-flex min-h-11 items-center gap-1.5",
                    isActive ? "text-foreground" : "text-muted-foreground",
                  ].join(" ")
                }
              >
                <item.icon className="size-4" />
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="hidden items-center justify-self-end gap-1 md:flex">
            <ExportMenu />
            <ThemeToggle />
            <Button type="button" variant="ghost" size="icon" aria-label="退出" onClick={() => void onLogout()}>
              <LogOut />
            </Button>
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="md:hidden"
            aria-label="打开菜单"
            onClick={() => setMenuOpen(true)}
          >
            <Menu />
          </Button>
        </div>
      </header>
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="right" className="md:hidden">
          <SheetHeader>
            <SheetTitle>菜单</SheetTitle>
          </SheetHeader>
          <nav className="grid gap-1 px-4">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  [
                    "inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm",
                    isActive
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground",
                  ].join(" ")
                }
              >
                <item.icon className="size-4" />
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="mt-4 grid gap-3 border-t px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">导出数据</span>
              <ExportMenu />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">主题</span>
              <ThemeToggle />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">账号</span>
              <Button type="button" variant="outline" onClick={() => void onLogout()}>
                <LogOut />
                退出
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
      <ConnectionBanner />
      <main className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col overflow-hidden px-4 py-3 md:px-6 md:py-4">
        <div className="flex min-h-0 flex-1 flex-col">
          <Routes>
            <Route path="/" element={<MetricsChart />} />
            <Route path="/chart" element={<ChartRedirect />} />
            <Route path="/notes" element={<ReviewNotes />} />
          </Routes>
        </div>
      </main>
      <Toaster />
    </div>
  )
}

export default App
