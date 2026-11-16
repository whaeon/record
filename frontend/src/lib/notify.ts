import { toast } from "sonner"
import { isConnectionError } from "@/lib/http"

let lastConnToastAt = 0

export function errorMessage(err: unknown, fallback: string): string {
  if (isConnectionError(err)) return "服务未连接"
  if (err instanceof Error && err.message) return err.message
  return fallback
}

export function toastApiError(err: unknown, fallback: string, retry?: () => void) {
  if (isConnectionError(err)) {
    const now = Date.now()
    if (now - lastConnToastAt < 3000) return
    lastConnToastAt = now
  }
  toast.error(errorMessage(err, fallback), retry
    ? {
        action: {
          label: "重试",
          onClick: () => retry(),
        },
      }
    : undefined)
}
