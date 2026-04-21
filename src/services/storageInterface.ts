import type { Diagram } from '@/types/diagram'
import type { Building } from '@/types/indoor'

// --- Generic repository interface ---
// Maps 1:1 to future PostgreSQL REST API endpoints.
// Each method corresponds to a standard CRUD operation.

export interface StorageRepository<T extends { id: string }> {
  getAll(): Promise<T[]>
  getById(id: string): Promise<T | undefined>
  create(item: T): Promise<T>
  update(id: string, patch: Partial<T>): Promise<T>
  delete(id: string): Promise<void>
  bulkCreate(items: T[]): Promise<T[]>
  bulkDelete(ids: string[]): Promise<void>
}

// --- Binary/blob storage for large files (SVG floorplans, images) ---

export interface BlobStorageRepository {
  get(key: string): Promise<string | null>
  put(key: string, data: string): Promise<void>
  delete(key: string): Promise<void>
  getAllKeys(): Promise<string[]>
}

// --- Key-value store for settings ---

export interface SettingsRepository {
  get<T>(key: string): Promise<T | null>
  set<T>(key: string, value: T): Promise<void>
  delete(key: string): Promise<void>
}

// --- Top-level storage service ---
// Single entry point for all persistence operations.
// Swap implementation (IndexedDB → REST API) without changing store code.

export interface StorageService {
  diagrams: StorageRepository<Diagram>
  buildings: StorageRepository<Building>
  blobs: BlobStorageRepository
  settings: SettingsRepository

  init(): Promise<void>
  close(): Promise<void>
}
