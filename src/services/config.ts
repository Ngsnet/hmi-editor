export interface ApiServer {
  url: string
  name: string
}

export interface AppConfig {
  apiServers: ApiServer[]
  appTitle: string
}

const defaultConfig: AppConfig = {
  apiServers: [
    { url: 'https://cem2.unimonitor.eu/cemapi/api', name: 'CEM2 Unimonitor' },
  ],
  appTitle: 'HMI Editor',
}

let _config: AppConfig = { ...defaultConfig }
let _activeApiUrl: string = defaultConfig.apiServers[0]?.url ?? ''
let _loaded = false

export async function loadConfig(): Promise<AppConfig> {
  if (_loaded) return _config

  try {
    const base = import.meta.env.BASE_URL ?? '/'
    const response = await fetch(`${base}config.json`, { cache: 'no-cache' })
    if (response.ok) {
      const contentType = response.headers.get('content-type') ?? ''
      if (contentType.includes('application/json')) {
        const json = await response.json()
        _config = { ...defaultConfig, ...json }
      }
    }
  } catch (e) {
    console.warn('Failed to load config.json, using defaults:', e)
  }

  _loaded = true

  const stored = localStorage.getItem('cem_active_api_url')
  const urls = getApiServers().map((s) => s.url)
  _activeApiUrl = (stored && urls.includes(stored)) ? stored : urls[0] ?? ''
  return _config
}

export function getConfig(): AppConfig {
  return _config
}

export function getApiServers(): ApiServer[] {
  return _config.apiServers.filter((s) => s.url.length > 0)
}

export function getActiveApiUrl(): string {
  return _activeApiUrl
}

export function setActiveApiUrl(url: string) {
  _activeApiUrl = url
  localStorage.setItem('cem_active_api_url', url)
}
