export class ApiError extends Error {
  status: number
  body: unknown

  constructor(status: number, message: string, body?: unknown) {
    super(message)
    this.status = status
    this.body = body
  }
}

export class ConnectionError extends Error {
  constructor(message = "服务未连接") {
    super(message)
    this.name = "ConnectionError"
  }
}

type ConnListener = (connected: boolean) => void

let connected = true
const connListeners = new Set<ConnListener>()

export function subscribeConnection(fn: ConnListener): () => void {
  connListeners.add(fn)
  fn(connected)
  return () => {
    connListeners.delete(fn)
  }
}

function setConnected(next: boolean) {
  if (connected === next) return
  connected = next
  connListeners.forEach((fn) => fn(connected))
}

export function isConnectionError(err: unknown): boolean {
  return err instanceof ConnectionError
}

const GATEWAY = new Set([502, 503, 504])

type UnauthorizedListener = () => void
const unauthorizedListeners = new Set<UnauthorizedListener>()

export function subscribeUnauthorized(fn: UnauthorizedListener): () => void {
  unauthorizedListeners.add(fn)
  return () => {
    unauthorizedListeners.delete(fn)
  }
}

function notifyUnauthorized(input: RequestInfo | URL) {
  const url = typeof input === "string" ? input : input instanceof URL ? input.pathname : ""
  if (url.includes("/api/login")) {
    return
  }
  unauthorizedListeners.forEach((fn) => fn())
}

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  try {
    const res = await fetch(input, { credentials: "include", ...init })
    if (res.status === 401) {
      notifyUnauthorized(input)
    }
    const ct = res.headers.get("content-type") ?? ""
    if (GATEWAY.has(res.status) || (res.status >= 500 && !ct.includes("application/json"))) {
      setConnected(false)
      throw new ConnectionError()
    }
    setConnected(true)
    return res
  } catch (err) {
    if (err instanceof ConnectionError) throw err
    setConnected(false)
    throw new ConnectionError()
  }
}

export async function readError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string }
    return body.error ?? res.statusText
  } catch {
    return res.statusText
  }
}

export async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let body: unknown
    try {
      body = await res.json()
    } catch {
      throw new ApiError(res.status, res.statusText)
    }
    const message =
      body && typeof body === "object" && "error" in body && typeof body.error === "string"
        ? body.error
        : res.statusText
    throw new ApiError(res.status, message, body)
  }
  return res.json() as Promise<T>
}
