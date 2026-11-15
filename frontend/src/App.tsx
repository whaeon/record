import { NavLink, Route, Routes } from "react-router-dom"
import { ClipboardList, LineChart, NotebookPen } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import MetricsEntry from "@/pages/MetricsEntry"
import MetricsChart from "@/pages/MetricsChart"
import ReviewNotes from "@/pages/ReviewNotes"

const navItems = [
  { to: "/", label: "指标录入", icon: ClipboardList, end: true },
  { to: "/chart", label: "历史图表", icon: LineChart, end: false },
  { to: "/notes", label: "复盘记录", icon: NotebookPen, end: false },
] as const

function App() {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="border-b bg-background">
        <div className="mx-auto grid max-w-6xl grid-cols-3 items-center px-6 py-3">
          <span className="justify-self-start font-medium">交易复盘</span>
          <nav className="flex items-center justify-center gap-6 text-sm">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  [
                    "inline-flex items-center gap-1.5",
                    isActive ? "text-foreground" : "text-muted-foreground",
                  ].join(" ")
                }
              >
                <item.icon className="size-4" />
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="justify-self-end">
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-6">
        <Routes>
          <Route path="/" element={<MetricsEntry />} />
          <Route path="/chart" element={<MetricsChart />} />
          <Route path="/notes" element={<ReviewNotes />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
