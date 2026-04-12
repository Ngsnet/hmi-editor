import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export const useThemeStore = defineStore('theme', () => {
  const isDark = ref(true)

  function toggle() {
    isDark.value = !isDark.value
  }

  // Apply theme class to document
  watch(isDark, (dark) => {
    document.documentElement.classList.toggle('theme-light', !dark)
    document.documentElement.classList.toggle('theme-dark', dark)
    localStorage.setItem('hmi-theme', dark ? 'dark' : 'light')
  }, { immediate: true })

  // Load saved preference
  const saved = localStorage.getItem('hmi-theme')
  if (saved === 'light') isDark.value = false

  return { isDark, toggle }
})
