import { apiFetch, parseJson } from "@/lib/http"

export type Me = {
  id: number
  username: string
  name: string
}

export async function login(username: string, password: string): Promise<Me> {
  const res = await apiFetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  })
  return parseJson<Me>(res)
}

export async function logout(): Promise<void> {
  await apiFetch("/api/logout", { method: "POST" })
}

export async function getMe(): Promise<Me> {
  const res = await apiFetch("/api/me")
  return parseJson<Me>(res)
}
