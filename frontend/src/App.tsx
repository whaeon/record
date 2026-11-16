import { useState } from "react"
import { NavLink, Route, Routes } from "react-router-dom"
import { ClipboardList, LineChart, Menu, NotebookPen } from "lucide-react"
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
import MetricsEntry from "@/pages/MetricsEntry"
import MetricsChart from "@/pages/MetricsChart"
import ReviewNotes from "@/pages/ReviewNotes"

const navItems = [
  { to: "/", label: "交易策略", icon: ClipboardList, end: true },
  { to: "/chart", label: "历史图表", icon: LineChart, end: false },
  { to: "/notes", label: "复盘记录", icon: NotebookPen, end: false },
] as const

function App() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="min-h-svh overflow-x-hidden bg-background text-foreground">
      <header className="border-b bg-background">
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
          </div>
        </SheetContent>
      </Sheet>
      <ConnectionBanner />
      <main className="mx-auto max-w-6xl px-4 py-4 md:px-6 md:py-6">
        <Routes>
          <Route path="/" element={<MetricsEntry />} />
          <Route path="/chart" element={<MetricsChart />} />
          <Route path="/notes" element={<ReviewNotes />} />
        </Routes>
      </main>
      <Toaster />
    </div>
  )
}

export default App
