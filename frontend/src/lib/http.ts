export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
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
    throw new ApiError(res.status, await readError(res))
  }
  return res.json() as Promise<T>
}
