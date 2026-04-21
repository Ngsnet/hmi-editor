import { openDB, type IDBPDatabase } from 'idb'
import type { Diagram } from '@/types/diagram'
import type { Building } from '@/types/indoor'
import type {
  StorageService,
  StorageRepository,
  BlobStorageRepository,
  SettingsRepository,
} from './storageInterface'

const DB_NAME = 'hmi-editor'
const DB_VERSION = 1

// --- Generic IndexedDB repository ---

class IndexedDbRepository<T extends { id: string }> implements StorageRepository<T> {
  constructor(
    private getDb: () => IDBPDatabase,
    private storeName: string,
  ) {}

  async getAll(): Promise<T[]> {
    return this.getDb().getAll(this.storeName)
  }

  async getById(id: string): Promise<T | undefined> {
    return this.getDb().get(this.storeName, id)
  }

  async create(item: T): Promise<T> {
    await this.getDb().put(this.storeName, item)
    return item
  }

  async update(id: string, patch: Partial<T>): Promise<T> {
    const existing = await this.getById(id)
    if (!existing) throw new Error(`${this.storeName}/${id} not found`)
    const updated = { ...existing, ...patch }
    await this.getDb().put(this.storeName, updated)
    return updated
  }

  async delete(id: string): Promise<void> {
    await this.getDb().delete(this.storeName, id)
  }

  async bulkCreate(items: T[]): Promise<T[]> {
    const tx = this.getDb().transaction(this.storeName, 'readwrite')
    await Promise.all([
      ...items.map(item => tx.store.put(item)),
      tx.done,
    ])
    return items
  }

  async bulkDelete(ids: string[]): Promise<void> {
    const tx = this.getDb().transaction(this.storeName, 'readwrite')
    await Promise.all([
      ...ids.map(id => tx.store.delete(id)),
      tx.done,
    ])
  }
}

// --- Blob storage (SVG floorplans, large files) ---

class IndexedDbBlobRepository implements BlobStorageRepository {
  constructor(
    private getDb: () => IDBPDatabase,
    private storeName: string,
  ) {}

  async get(key: string): Promise<string | null> {
    const result = await this.getDb().get(this.storeName, key)
    return result ?? null
  }

  async put(key: string, data: string): Promise<void> {
    await this.getDb().put(this.storeName, data, key)
  }

  async delete(key: string): Promise<void> {
    await this.getDb().delete(this.storeName, key)
  }

  async getAllKeys(): Promise<string[]> {
    const keys = await this.getDb().getAllKeys(this.storeName)
    return keys.map(k => String(k))
  }
}

// --- Settings key-value store ---

class IndexedDbSettingsRepository implements SettingsRepository {
  constructor(
    private getDb: () => IDBPDatabase,
    private storeName: string,
  ) {}

  async get<T>(key: string): Promise<T | null> {
    const result = await this.getDb().get(this.storeName, key)
    return result ?? null
  }

  async set<T>(key: string, value: T): Promise<void> {
    await this.getDb().put(this.storeName, value, key)
  }

  async delete(key: string): Promise<void> {
    await this.getDb().delete(this.storeName, key)
  }
}

// --- Main IndexedDB storage service ---

export class IndexedDbStorageService implements StorageService {
  private db: IDBPDatabase | null = null

  diagrams!: StorageRepository<Diagram>
  buildings!: StorageRepository<Building>
  blobs!: BlobStorageRepository
  settings!: SettingsRepository

  private getDb(): IDBPDatabase {
    if (!this.db) throw new Error('IndexedDB not initialized — call init() first')
    return this.db
  }

  async init(): Promise<void> {
    this.db = await openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // diagrams — full Diagram documents (layers + elements embedded)
        // → PostgreSQL: diagrams table + layers table + elements table (normalized by backend)
        if (!db.objectStoreNames.contains('diagrams')) {
          const store = db.createObjectStore('diagrams', { keyPath: 'id' })
          store.createIndex('by_name', 'name')
          store.createIndex('by_updated', 'updatedAt')
        }

        // buildings — full Building documents (floors + units embedded)
        // → PostgreSQL: buildings table + floors table + units table
        if (!db.objectStoreNames.contains('buildings')) {
          const store = db.createObjectStore('buildings', { keyPath: 'id' })
          store.createIndex('by_name', 'name')
        }

        // blobs — large binary/text data (SVG floorplans, images)
        // Key-value store: key = floorId or assetId, value = string data
        // → PostgreSQL: file storage or S3 bucket
        if (!db.objectStoreNames.contains('blobs')) {
          db.createObjectStore('blobs')
        }

        // settings — application settings (key-value)
        // → PostgreSQL: user_settings table
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings')
        }
      },
    })

    const boundGetDb = this.getDb.bind(this)
    this.diagrams = new IndexedDbRepository<Diagram>(boundGetDb, 'diagrams')
    this.buildings = new IndexedDbRepository<Building>(boundGetDb, 'buildings')
    this.blobs = new IndexedDbBlobRepository(boundGetDb, 'blobs')
    this.settings = new IndexedDbSettingsRepository(boundGetDb, 'settings')
  }

  async close(): Promise<void> {
    this.db?.close()
    this.db = null
  }
}
