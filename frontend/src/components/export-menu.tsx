import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ApiError, apiFetch, readError } from "@/lib/http"
import { toastApiError } from "@/lib/notify"

async function download(path: string, fallbackName: string) {
  const res = await apiFetch(path)
  if (!res.ok) {
    throw new ApiError(res.status, await readError(res))
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  const header = res.headers.get("content-disposition")
  const match = header?.match(/filename="?([^"]+)"?/)
  a.href = url
  a.download = match?.[1] ?? fallbackName
  a.click()
  URL.revokeObjectURL(url)
}

export function ExportMenu() {
  async function onExport(path: string, name: string) {
    try {
      await download(path, name)
    } catch (err) {
      toastApiError(err, "导出失败", () => void onExport(path, name))
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="导出数据">
          <Download />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        <DropdownMenuItem onSelect={() => void onExport("/api/export/metrics.csv", "metrics.csv")}>
          导出指标 CSV
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void onExport("/api/export/notes.md", "notes.zip")}>
          导出复盘 ZIP
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
