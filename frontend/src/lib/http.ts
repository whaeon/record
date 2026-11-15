export class ApiError extends Error {
  status: number
  body: unknown

  constructor(status: number, message: string, body?: unknown) {
    super(message)
    this.status = status
    this.body = body
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
