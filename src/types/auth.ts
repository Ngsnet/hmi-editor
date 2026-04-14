export interface AuthUser {
  username: string
  showName?: string
  company?: string
  companyId?: number
}

export interface LoginRequest {
  username: string
  password: string
}

/** Response from CEM API login (id=4) */
export interface CemLoginResponse {
  user: string
  access_token: string
  refresh_token: string
  valid_to: number
}

/** Response from CEM API user info (id=9) */
export interface CemUserInfoResponse {
  show_name: string
  osoba: string
  firma: string
  oso_id: number
  fir_id: number
  log_od: number | null
  log_do: number | null
  zak_id: number
}

/** Persisted in localStorage under 'cem_auth' */
export interface StoredAuth {
  access_token: string
  refresh_token: string
  valid_to: number
  username: string
}

export interface ApiError {
  status: number
  message: string
  errors?: unknown
}
