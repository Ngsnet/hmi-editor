import { getStorageService } from '@/services/storageFactory'

function blobKey(floorId: string): string {
  return `floorplan:${floorId}`
}

export async function saveFloorplanSvg(floorId: string, svgText: string): Promise<void> {
  const storage = getStorageService()
  await storage.blobs.put(blobKey(floorId), svgText)
}

export async function loadFloorplanSvg(floorId: string): Promise<string | null> {
  const storage = getStorageService()
  return storage.blobs.get(blobKey(floorId))
}

export async function deleteFloorplanSvg(floorId: string): Promise<void> {
  const storage = getStorageService()
  await storage.blobs.delete(blobKey(floorId))
}
