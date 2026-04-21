import api from './api'
import { CEM_API_IDS } from '@/constants/cemApi'
import type {
  CemObjectRaw,
  CemObjectsResponse,
  CemObject,
  CemMeterRaw,
  CemMetersResponse,
  CemMeter,
  CemCounterRaw,
  CemCountersResponse,
  CemCounter,
  CemCounterTypeRaw,
  CemCounterType,
  CemLastReadingRaw,
  CemSingleReadingRaw,
} from '@/types/cem'

// =====================
// Counter types cache
// =====================

let counterTypesMap = new Map<number, CemCounterType>()

function getCounterType(potId: number): CemCounterType | undefined {
  return counterTypesMap.get(potId)
}

// =====================
// Mapping functions
// =====================

function mapRawObject(raw: CemObjectRaw): CemObject {
  return {
    id: raw.mis_id,
    name: raw.mis_nazev?.trim() || '\u2302 Home',
    name2: raw.mis_nazev2 ?? undefined,
    type: raw.mit_id === -1000 ? 'installPoint' : 'location',
    parentId: raw.mis_idp ?? undefined,  // null from API → undefined = root
    sortOrder: raw.mis_sort,
    path: raw.mis_cesta,
    activeSince: raw.mis_od ? new Date(raw.mis_od).toISOString().slice(0, 10) : undefined,
    activeUntil: raw.mis_do ? new Date(raw.mis_do).toISOString().slice(0, 10) : undefined,
    siteTypeId: raw.mit_id,
  }
}

function mapRawMeter(raw: CemMeterRaw): CemMeter {
  return {
    id: raw.me_id,
    serial: raw.me_serial,
    description: raw.me_desc,
    objectId: raw.mis_id,
    meterTypeName: raw.me_typ_pzn,
    validFrom: raw.me_od ? new Date(raw.me_od).toISOString().slice(0, 10) : null,
    validTo: raw.me_do ? new Date(raw.me_do).toISOString().slice(0, 10) : null,
    isBilling: !!raw.me_fakt,
  }
}

function mapRawCounter(raw: CemCounterRaw): CemCounter {
  const ct = getCounterType(raw.pot_id)
  return {
    id: raw.var_id,
    meterId: raw.me_id,
    typeId: raw.pot_id,
    typeName: ct?.label ?? raw.poc_desc ?? `POT${raw.pot_id}`,
    unit: ct?.unit ?? '',
    color: ct?.color ?? '#585858',
    lastValue: raw.var_lastvar,
    lastTime: raw.var_lasttime
      ? new Date(raw.var_lasttime).toLocaleString('cs-CZ')
      : null,
    multiplier: raw.var_nasob,
    isPrimary: raw.poc_primary,
    isService: raw.poc_serv ?? false,
    description: raw.poc_desc,
  }
}

function deduplicateById<T extends { id: number }>(items: T[]): T[] {
  const seen = new Set<number>()
  return items.filter(item => {
    if (seen.has(item.id)) return false
    seen.add(item.id)
    return true
  })
}

// =====================
// Service API
// =====================

export const cemService = {
  /**
   * Fetch counter types (API 222) and cache them.
   */
  async fetchCounterTypes(): Promise<CemCounterType[]> {
    const { data } = await api.get<{ data: CemCounterTypeRaw[]; action: string }>('', {
      params: { id: CEM_API_IDS.COUNTER_TYPES },
    })
    const types = data.data.map((t): CemCounterType => ({
      id: t.pot_id,
      key: t.lt_key,
      label: t.lt_key.replace('LB_POCTYP_', ''),
      unit: t.jed_zkr.trim(),
      color: t.pot_defcolor,
      type: t.pot_type,
    }))
    counterTypesMap = new Map(types.map(t => [t.id, t]))
    return types
  },

  /**
   * Fetch all objects (API 106). Filters to active only (mis_do=null).
   * Root objects have mis_idp=null → parentId=undefined.
   */
  async fetchObjects(): Promise<CemObject[]> {
    const { data } = await api.get<CemObjectsResponse>('', {
      params: { id: CEM_API_IDS.OBJECTS, depth: 99 },
    })

    // Filter active, deduplicate
    const seen = new Set<number>()
    return data.data
      .filter(r => {
        if (r.mis_do !== null) return false
        if (seen.has(r.mis_id)) return false
        seen.add(r.mis_id)
        return true
      })
      .map(mapRawObject)
  },

  /**
   * Fetch all active meters (API 108). Filters to me_do=null.
   */
  async fetchAllMeters(): Promise<CemMeter[]> {
    const { data } = await api.get<CemMetersResponse>('', {
      params: { id: CEM_API_IDS.METERS },
    })
    return deduplicateById(
      data.data
        .filter(r => r.me_do === null)
        .map(mapRawMeter)
    )
  },

  /**
   * Fetch all counters (API 107).
   */
  async fetchAllCounters(): Promise<CemCounter[]> {
    const { data } = await api.get<CemCountersResponse>('', {
      params: { id: CEM_API_IDS.COUNTERS },
    })
    return data.data.map(mapRawCounter)
  },

  /**
   * Fetch last reading for one or more counters (API 8).
   */
  async getLastReading(varIds: number[]): Promise<CemLastReadingRaw[]> {
    if (varIds.length === 0) return []

    if (varIds.length === 1) {
      const { data } = await api.get<CemLastReadingRaw[]>('', {
        params: { id: CEM_API_IDS.LAST_READING, var_id: varIds[0] },
      })
      return data
    }

    const { data } = await api.post<CemLastReadingRaw[]>(
      '',
      varIds.map(id => ({ var_id: id })),
      { params: { id: CEM_API_IDS.LAST_READING } },
    )
    return data
  },

  /**
   * Fetch raw readings for a single counter (API 3) within a date range.
   */
  async getSingleReadings(
    varId: number,
    from: string,
    to: string,
  ): Promise<CemSingleReadingRaw[]> {
    const { data } = await api.get<CemSingleReadingRaw[]>('', {
      params: { id: CEM_API_IDS.SINGLE_READING, var_id: varId, from, to },
    })
    return data
  },

  getCounterType,

  /**
   * Auto-detect media layer for a counter based on its type name and unit.
   */
  detectMediaLayer(counter: { typeName: string; unit: string }): 'water' | 'electric' | 'heat' | 'cool' | 'temperature' | 'other' {
    const name = counter.typeName.toLowerCase()
    const unit = counter.unit.toLowerCase()

    if (unit.includes('m³') || unit.includes('m3') || name.includes('water') || name.includes('vod')) return 'water'
    if (unit.includes('kwh') || unit.includes('mwh') || name.includes('elec') || name.includes('elek')) return 'electric'
    if (unit.includes('°c') || unit.includes('°f') || name.includes('temp') || name.includes('tepl')) return 'temperature'
    if (unit.includes('gj') || unit.includes('mwh')) {
      if (name.includes('cool') || name.includes('chlaz') || name.includes('chlad')) return 'cool'
      if (name.includes('heat') || name.includes('top') || name.includes('tepl')) return 'heat'
      return 'heat' // GJ default
    }
    return 'other'
  },
}
