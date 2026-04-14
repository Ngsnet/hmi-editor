import axios from 'axios'
import type { ApiError, StoredAuth } from '@/types/auth'
import { getActiveApiUrl } from './config'

const api = axios.create({
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use((config) => {
  if (!config.baseURL) {
    config.baseURL = getActiveApiUrl()
  }

  const storedAuth = localStorage.getItem('cem_auth')
  if (storedAuth) {
    try {
      const auth = JSON.parse(storedAuth) as StoredAuth
      config.headers.Authorization = `Bearer ${auth.access_token}`
    } catch {
      // Invalid stored auth, ignore
    }
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const apiError: ApiError = {
      status: error.response?.status ?? 0,
      message: error.response?.data?.message ?? error.message,
      errors: error.response?.data?.errors,
    }

    const isLoginRequest = error.config?.params?.id === 4
    if (apiError.status === 401 && !isLoginRequest) {
      localStorage.removeItem('cem_auth')
    }

    return Promise.reject(apiError)
  },
)

export default api
