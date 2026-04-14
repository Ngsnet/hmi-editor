import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { authService } from '@/services/auth.service'
import type { AuthUser, LoginRequest, StoredAuth } from '@/types/auth'

const STORAGE_KEY = 'cem_auth'

function loadStoredAuth(): StoredAuth | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as StoredAuth
  } catch {
    return null
  }
}

function saveAuth(auth: StoredAuth) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(auth))
}

function clearAuth() {
  localStorage.removeItem(STORAGE_KEY)
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null)
  const accessToken = ref<string | null>(null)
  const refreshToken = ref<string | null>(null)
  const validTo = ref<number | null>(null)
  const isLoading = ref(false)

  const isAuthenticated = computed(() => !!accessToken.value)

  const userDisplayName = computed(() => {
    if (!user.value) return ''
    return user.value.showName || user.value.username
  })

  async function login(credentials: LoginRequest) {
    isLoading.value = true
    try {
      const response = await authService.login(credentials.username, credentials.password)

      accessToken.value = response.access_token
      refreshToken.value = response.refresh_token
      validTo.value = response.valid_to

      saveAuth({
        access_token: response.access_token,
        refresh_token: response.refresh_token,
        valid_to: response.valid_to,
        username: response.user,
      })

      await fetchUserInfo(response.user)
    } finally {
      isLoading.value = false
    }
  }

  async function fetchUserInfo(username?: string) {
    try {
      const info = await authService.getCurrentUser()
      user.value = {
        username: username ?? info.osoba ?? '',
        showName: info.show_name,
        company: info.firma,
        companyId: info.fir_id,
      }
    } catch {
      const stored = loadStoredAuth()
      if (stored) {
        user.value = {
          username: stored.username,
        }
      }
    }
  }

  function logout() {
    accessToken.value = null
    refreshToken.value = null
    validTo.value = null
    user.value = null
    clearAuth()
  }

  async function initAuth() {
    const stored = loadStoredAuth()
    if (!stored) return

    if (Date.now() > stored.valid_to) {
      clearAuth()
      return
    }

    accessToken.value = stored.access_token
    refreshToken.value = stored.refresh_token
    validTo.value = stored.valid_to

    try {
      await fetchUserInfo(stored.username)
    } catch {
      accessToken.value = null
      refreshToken.value = null
      validTo.value = null
      user.value = null
      clearAuth()
    }
  }

  return {
    user,
    accessToken,
    refreshToken,
    validTo,
    isLoading,
    isAuthenticated,
    userDisplayName,
    login,
    logout,
    initAuth,
  }
})
