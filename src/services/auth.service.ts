import api from './api'
import type { CemLoginResponse, CemUserInfoResponse } from '@/types/auth'

const CEM_API_IDS = {
  LOGIN: 4,
  USER_INFO: 9,
} as const

export const authService = {
  async login(username: string, password: string): Promise<CemLoginResponse> {
    const body = new URLSearchParams()
    body.append('user', username)
    body.append('pass', password)

    const { data } = await api.post<CemLoginResponse>('', body, {
      params: { id: CEM_API_IDS.LOGIN },
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
    return data
  },

  async getCurrentUser(): Promise<CemUserInfoResponse> {
    const { data } = await api.get<CemUserInfoResponse>('', {
      params: { id: CEM_API_IDS.USER_INFO },
    })
    return data
  },
}
