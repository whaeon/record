import { NavLink, Route, Routes } from "react-router-dom"
import { ThemeToggle } from "@/components/theme-toggle"
import MetricsEntry from "@/pages/MetricsEntry"
import MetricsChart from "@/pages/MetricsChart"
import ReviewNotes from "@/pages/ReviewNotes"

function App() {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-3">
          <span className="font-medium">交易复盘</span>
          <nav className="flex gap-4 text-sm">
            <NavLink
              to="/"
              className={({ isActive }) =>
                isActive ? "text-foreground" : "text-muted-foreground"
              }
              end
            >
              指标录入
            </NavLink>
            <NavLink
              to="/chart"
              className={({ isActive }) =>
                isActive ? "text-foreground" : "text-muted-foreground"
              }
            >
              历史图表
            </NavLink>
            <NavLink
              to="/notes"
              className={({ isActive }) =>
                isActive ? "text-foreground" : "text-muted-foreground"
              }
            >
              复盘记录
            </NavLink>
          </nav>
          <div className="ml-auto">
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
