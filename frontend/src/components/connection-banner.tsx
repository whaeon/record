import { useEffect, useState } from "react"
import { apiFetch, subscribeConnection } from "@/lib/http"

export function ConnectionBanner() {
  const [ok, setOk] = useState(true)

  useEffect(() => subscribeConnection(setOk), [])

  useEffect(() => {
    void apiFetch("/api/strategies").catch(() => {})
  }, [])

  if (ok) return null

  return (
    <div
      role="status"
      className="border-b bg-destructive/10 px-4 py-2 text-center text-sm text-destructive"
    >
      服务未连接
    </div>
  )
}
