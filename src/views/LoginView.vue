<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import { getApiServers, getActiveApiUrl, setActiveApiUrl } from '@/services/config'
import type { ApiServer } from '@/services/config'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const username = ref('demo')
const password = ref('demo')
const showPassword = ref(false)
const error = ref('')
const selectedApiUrl = ref('')
const apiServers = ref<ApiServer[]>([])

onMounted(() => {
  apiServers.value = getApiServers()
  selectedApiUrl.value = getActiveApiUrl()
})

async function handleLogin() {
  error.value = ''
  setActiveApiUrl(selectedApiUrl.value)

  try {
    await authStore.login({ username: username.value, password: password.value })
    const redirect = (route.query.redirect as string) || '/'
    router.push(redirect)
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string }
    if (err.status === 401) {
      error.value = 'Wrong username or password'
    } else {
      error.value = err.message || 'Login failed'
    }
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-[#1a1a2e]">
    <form
      @submit.prevent="handleLogin"
      class="bg-[#16213e] rounded-xl shadow-2xl p-10 w-96 space-y-5"
    >
      <div class="text-center mb-6">
        <h1 class="text-2xl font-bold text-white">HMI Editor</h1>
        <p class="text-sm text-gray-400 mt-1">Sign in to continue</p>
      </div>

      <!-- Server selector -->
      <div v-if="apiServers.length > 1">
        <label class="block text-sm font-medium text-gray-300 mb-1">Server</label>
        <select
          v-model="selectedApiUrl"
          class="w-full bg-[#0f3460] border border-gray-600 text-white rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option v-for="server in apiServers" :key="server.url" :value="server.url">
            {{ server.name }}
          </option>
        </select>
      </div>

      <!-- Username -->
      <div>
        <label class="block text-sm font-medium text-gray-300 mb-1">Username</label>
        <input
          v-model="username"
          type="text"
          autocomplete="username"
          class="w-full bg-[#0f3460] border border-gray-600 text-white rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500"
          placeholder="Enter username"
        />
      </div>

      <!-- Password -->
      <div>
        <label class="block text-sm font-medium text-gray-300 mb-1">Password</label>
        <div class="relative">
          <input
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            autocomplete="current-password"
            class="w-full bg-[#0f3460] border border-gray-600 text-white rounded-lg px-3 py-2.5 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500"
            placeholder="Enter password"
          />
          <button
            type="button"
            @click="showPassword = !showPassword"
            class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
          >
            <svg v-if="!showPassword" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
              <path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd" />
            </svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clip-rule="evenodd" />
              <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Error -->
      <div v-if="error" class="bg-red-900/50 border border-red-700 text-red-300 rounded-lg px-4 py-2.5 text-sm">
        {{ error }}
      </div>

      <!-- Submit -->
      <button
        type="submit"
        :disabled="authStore.isLoading"
        class="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors cursor-pointer disabled:cursor-wait"
      >
        {{ authStore.isLoading ? 'Signing in...' : 'Sign in' }}
      </button>
    </form>
  </div>
</template>
