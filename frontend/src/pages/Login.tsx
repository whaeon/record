import { useState, type FormEvent } from "react"
import { login, type Me } from "@/api/auth"
import { ThemeToggle } from "@/components/theme-toggle"
import { ConnectionBanner } from "@/components/connection-banner"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ApiError } from "@/lib/http"
import { errorMessage } from "@/lib/notify"

export function Login({ onSuccess }: { onSuccess: (me: Me) => void }) {
  const [username, setUsername] = useState("admin")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError("")
    setPending(true)
    try {
      const me = await login(username.trim(), password)
      onSuccess(me)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError("用户名或密码错误")
      } else {
        setError(errorMessage(err, "登录失败"))
      }
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      <header className="shrink-0 border-b bg-background">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 md:px-6">
          <span className="font-medium">交易复盘</span>
          <ThemeToggle />
        </div>
      </header>
      <ConnectionBanner />
      <main className="mx-auto flex min-h-0 w-full max-w-sm flex-1 items-center px-4">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>登录</CardTitle>
            <CardDescription>单用户门禁，不开放注册</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={onSubmit}>
              <div className="grid gap-2">
                <Label htmlFor="username">用户名</Label>
                <Input
                  id="username"
                  name="username"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">密码</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              {error ? (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              ) : null}
              <Button type="submit" disabled={pending}>
                {pending ? "登录中…" : "登录"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
