import type { Diagram } from '@/types/diagram'
import type { Building } from '@/types/indoor'
import type {
  StorageService,
  StorageRepository,
  BlobStorageRepository,
  SettingsRepository,
} from './storageInterface'

// --- Generic REST API repository ---
// Each method maps to a standard REST endpoint:
//   getAll()     → GET    /api/{resource}
//   getById(id)  → GET    /api/{resource}/{id}
//   create(item) → POST   /api/{resource}
//   update(id)   → PATCH  /api/{resource}/{id}
//   delete(id)   → DELETE /api/{resource}/{id}

class RestApiRepository<T extends { id: string }> implements StorageRepository<T> {
  constructor(
    private baseUrl: string,
    private resource: string,
    private getHeaders: () => HeadersInit,
  ) {}

  private url(id?: string): string {
    return id
      ? `${this.baseUrl}/${this.resource}/${id}`
      : `${this.baseUrl}/${this.resource}`
  }

  async getAll(): Promise<T[]> {
    const res = await fetch(this.url(), { headers: this.getHeaders() })
    if (!res.ok) throw new Error(`GET ${this.url()} failed: ${res.status}`)
    return res.json()
  }

  async getById(id: string): Promise<T | undefined> {
    const res = await fetch(this.url(id), { headers: this.getHeaders() })
    if (res.status === 404) return undefined
    if (!res.ok) throw new Error(`GET ${this.url(id)} failed: ${res.status}`)
    return res.json()
  }

  async create(item: T): Promise<T> {
    const res = await fetch(this.url(), {
      method: 'POST',
      headers: { ...this.getHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    })
    if (!res.ok) throw new Error(`POST ${this.url()} failed: ${res.status}`)
    return res.json()
  }

  async update(id: string, patch: Partial<T>): Promise<T> {
    const res = await fetch(this.url(id), {
      method: 'PATCH',
      headers: { ...this.getHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (!res.ok) throw new Error(`PATCH ${this.url(id)} failed: ${res.status}`)
    return res.json()
  }

  async delete(id: string): Promise<void> {
    const res = await fetch(this.url(id), {
      method: 'DELETE',
      headers: this.getHeaders(),
    })
    if (!res.ok) throw new Error(`DELETE ${this.url(id)} failed: ${res.status}`)
  }

  async bulkCreate(items: T[]): Promise<T[]> {
    const res = await fetch(`${this.url()}/bulk`, {
      method: 'POST',
      headers: { ...this.getHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(items),
    })
    if (!res.ok) throw new Error(`POST ${this.url()}/bulk failed: ${res.status}`)
    return res.json()
  }

  async bulkDelete(ids: string[]): Promise<void> {
    const res = await fetch(`${this.url()}/bulk`, {
      method: 'DELETE',
      headers: { ...this.getHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
    if (!res.ok) throw new Error(`DELETE ${this.url()}/bulk failed: ${res.status}`)
  }
}

// --- REST API blob storage ---
// Maps to: GET/PUT/DELETE /api/blobs/{key}

class RestApiBlobRepository implements BlobStorageRepository {
  constructor(
    private baseUrl: string,
    private getHeaders: () => HeadersInit,
  ) {}

  async get(key: string): Promise<string | null> {
    const res = await fetch(`${this.baseUrl}/blobs/${key}`, { headers: this.getHeaders() })
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`GET blobs/${key} failed: ${res.status}`)
    return res.text()
  }

  async put(key: string, data: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/blobs/${key}`, {
      method: 'PUT',
      headers: { ...this.getHeaders(), 'Content-Type': 'text/plain' },
      body: data,
    })
    if (!res.ok) throw new Error(`PUT blobs/${key} failed: ${res.status}`)
  }

  async delete(key: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/blobs/${key}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    })
    if (!res.ok) throw new Error(`DELETE blobs/${key} failed: ${res.status}`)
  }

  async getAllKeys(): Promise<string[]> {
    const res = await fetch(`${this.baseUrl}/blobs`, { headers: this.getHeaders() })
    if (!res.ok) throw new Error(`GET blobs failed: ${res.status}`)
    return res.json()
  }
}

// --- REST API settings ---
// Maps to: GET/PUT/DELETE /api/settings/{key}

class RestApiSettingsRepository implements SettingsRepository {
  constructor(
    private baseUrl: string,
    private getHeaders: () => HeadersInit,
  ) {}

  async get<T>(key: string): Promise<T | null> {
    const res = await fetch(`${this.baseUrl}/settings/${key}`, { headers: this.getHeaders() })
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`GET settings/${key} failed: ${res.status}`)
    return res.json()
  }

  async set<T>(key: string, value: T): Promise<void> {
    const res = await fetch(`${this.baseUrl}/settings/${key}`, {
      method: 'PUT',
      headers: { ...this.getHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(value),
    })
    if (!res.ok) throw new Error(`PUT settings/${key} failed: ${res.status}`)
  }

  async delete(key: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/settings/${key}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    })
    if (!res.ok) throw new Error(`DELETE settings/${key} failed: ${res.status}`)
  }
}

// --- Main REST API storage service ---

export class RestApiStorageService implements StorageService {
  diagrams: StorageRepository<Diagram>
  buildings: StorageRepository<Building>
  blobs: BlobStorageRepository
  settings: SettingsRepository

  constructor(
    private baseUrl: string,
    private authTokenProvider?: () => string | null,
  ) {
    const getHeaders = (): HeadersInit => {
      const headers: Record<string, string> = {}
      const token = this.authTokenProvider?.()
      if (token) headers['Authorization'] = `Bearer ${token}`
      return headers
    }

    this.diagrams = new RestApiRepository<Diagram>(baseUrl, 'diagrams', getHeaders)
    this.buildings = new RestApiRepository<Building>(baseUrl, 'buildings', getHeaders)
    this.blobs = new RestApiBlobRepository(baseUrl, getHeaders)
    this.settings = new RestApiSettingsRepository(baseUrl, getHeaders)
  }

  async init(): Promise<void> {
    // No-op for REST API — server is always ready
  }

  async close(): Promise<void> {
    // No-op for REST API
  }
}
