import type {
  Achievement,
  AchievementsMe,
  Bet,
  BetCreate,
  BetStatus,
  BetType,
  BetUpdate,
  ImportSummary,
  Paginated,
  Rank,
  RankMe,
  RankingEntry,
  RankingPosition,
  Statistics,
  TokenResponse,
  User,
} from '@/types/api'

const BASE_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000').replace(/\/$/, '')
const TOKEN_KEY = 'fijazo_token'

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export const tokenStorage = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
}

/** La sesión murió (token expirado o cuenta desactivada): el AuthProvider escucha esto. */
export const SESSION_EXPIRED_EVENT = 'fijazo:session-expired'

/** Traduce el `detail` de FastAPI (string en errores de negocio, array en los 422). */
function parseDetail(body: unknown, status: number): string {
  if (typeof body === 'object' && body !== null && 'detail' in body) {
    const detail = (body as { detail: unknown }).detail
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail)) {
      return detail
        .map((e: { loc?: unknown[]; msg?: string }) => {
          const field = Array.isArray(e.loc) ? e.loc[e.loc.length - 1] : null
          return field ? `${String(field)}: ${e.msg}` : (e.msg ?? '')
        })
        .filter(Boolean)
        .join(' · ')
    }
  }
  return `Error ${status}`
}

interface RequestOptions {
  method?: string
  body?: unknown
  /** Endpoints públicos (login/registro) no envían Authorization. */
  auth?: boolean
  query?: Record<string, string | number | undefined>
  raw?: boolean
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true, query, raw = false } = options

  const url = new URL(`${BASE_URL}${path}`)
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '') url.searchParams.set(key, String(value))
    }
  }

  const headers: Record<string, string> = {}
  if (auth) {
    const token = tokenStorage.get()
    if (token) headers.Authorization = `Bearer ${token}`
  }

  let payload: BodyInit | undefined
  if (body instanceof FormData) {
    payload = body
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }

  let response: Response
  try {
    response = await fetch(url.toString(), { method, headers, body: payload })
  } catch {
    throw new ApiError('No se pudo conectar con la API. ¿Está levantada en ' + BASE_URL + '?', 0)
  }

  if (!response.ok) {
    let parsed: unknown = null
    try {
      parsed = await response.json()
    } catch {
      /* respuesta sin cuerpo JSON */
    }
    const message = parseDetail(parsed, response.status)

    // 401 = token inválido/expirado; 403 con sesión activa = cuenta desactivada por un admin.
    // En ambos casos el token guardado ya no sirve: forzamos logout.
    if (auth && (response.status === 401 || response.status === 403)) {
      window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT, { detail: message }))
    }
    throw new ApiError(message, response.status)
  }

  if (raw) return (await response.blob()) as T
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

export interface BetFilters {
  page?: number
  page_size?: number
  status?: BetStatus | ''
  sport?: string
  bet_type?: BetType | ''
}

export const api = {
  auth: {
    register: (data: { username: string; email: string; password: string }) =>
      request<User>('/auth/register', { method: 'POST', body: data, auth: false }),
    login: (data: { email: string; password: string }) =>
      request<TokenResponse>('/auth/login', { method: 'POST', body: data, auth: false }),
  },
  users: {
    me: () => request<User>('/users/me'),
  },
  bets: {
    list: (filters: BetFilters = {}) => request<Paginated<Bet>>('/bets', { query: { ...filters } }),
    get: (id: string) => request<Bet>(`/bets/${id}`),
    create: (data: BetCreate) => request<Bet>('/bets', { method: 'POST', body: data }),
    update: (id: string, data: BetUpdate) => request<Bet>(`/bets/${id}`, { method: 'PUT', body: data }),
    remove: (id: string) => request<void>(`/bets/${id}`, { method: 'DELETE' }),
    template: () => request<Blob>('/bets/template', { raw: true }),
    import: (file: File) => {
      const form = new FormData()
      form.append('file', file)
      return request<ImportSummary>('/bets/import', { method: 'POST', body: form })
    },
  },
  statistics: {
    me: () => request<Statistics>('/statistics/me'),
  },
  ranking: {
    list: (page = 1, pageSize = 20) =>
      request<Paginated<RankingEntry>>('/ranking', { query: { page, page_size: pageSize } }),
    top: (limit = 10) => request<RankingEntry[]>('/ranking/top', { query: { limit } }),
    me: () => request<RankingPosition>('/ranking/me'),
  },
  ranks: {
    list: () => request<Rank[]>('/ranks'),
    me: () => request<RankMe>('/ranks/me'),
  },
  achievements: {
    list: () => request<Achievement[]>('/achievements'),
    me: () => request<AchievementsMe>('/achievements/me'),
  },
}
