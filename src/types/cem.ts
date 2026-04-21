// =====================
// OBJECTS (API 106)
// =====================

export interface CemObjectRaw {
  mis_id: number
  mis_idp: number
  mis_nazev: string
  mis_nazev2: string | null
  mis_od: number
  mis_do: number | null
  mis_info: string | null
  mis_extid: string | null
  mis_extid2: string | null
  mis_pzn: string | null
  mis_sort: number | null
  mis_inst_pzn: string | null
  mit_id: number | null        // -1000 = install point
  mis_cesta: string
  gps_x?: number
  gps_y?: number
}

export interface CemObjectsResponse {
  action: string
  data: CemObjectRaw[]
}

export interface CemObject {
  id: number
  name: string
  name2?: string
  type: 'installPoint' | 'location'
  parentId?: number
  path?: string
  activeSince?: string
  activeUntil?: string
  siteTypeId?: number | null
  children?: CemObject[]
}

// =====================
// METERS (API 108)
// =====================

export interface CemMeterRaw {
  me_id: number
  me_serial: string | null
  me_desc: string | null
  mis_id: number
  met_id: number | null
  me_typ_pzn: string | null
  me_od: number | null
  me_do: number | null
  me_over: number | null
  me_alarm: number
  me_fakt: boolean
  me_zapoc: boolean
  me_sdil: number | null
  me_extid: string | null
  me_plom: string | null
  me_pot_id: number | null
}

export interface CemMetersResponse {
  action: string
  data: CemMeterRaw[]
}

export interface CemMeter {
  id: number
  serial: string | null
  description: string | null
  objectId: number
  meterTypeName: string | null
  validFrom: string | null
  validTo: string | null
  isBilling: boolean
}

// =====================
// COUNTERS (API 107)
// =====================

export interface CemCounterRaw {
  var_id: number
  var_lastvar: number | null
  var_lasttime: number | null
  var_nasob: number
  var_lastonly: boolean
  var_q: number
  pot_id: number
  poc_typode: number
  poc_perioda: number | null
  poc_serv: boolean | null
  poc_extid: string | null
  tds_id: number | null
  poc_primary: boolean
  me_id: number
  poc_insaval: boolean
  var_minint: number | null
  poc_desc: string | null
  poc_servis: number | null
}

export interface CemCountersResponse {
  action: string
  data: CemCounterRaw[]
}

export interface CemCounter {
  id: number              // var_id
  meterId: number         // me_id
  typeId: number          // pot_id
  typeName: string
  unit: string
  color: string
  lastValue: number | null
  lastTime: string | null
  multiplier: number
  isPrimary: boolean
  isService: boolean
  description: string | null
}

// =====================
// COUNTER TYPES (API 222)
// =====================

export interface CemCounterTypeRaw {
  pot_id: number
  lt_key: string
  jed_zkr: string
  pot_defcolor: string
  pot_type: number
}

export interface CemCounterType {
  id: number
  key: string
  label: string
  unit: string
  color: string
  type: number
}

// =====================
// READINGS (API 3, 8)
// =====================

export interface CemSingleReadingRaw {
  value: number
  timestamp: number  // epoch ms
}

export interface CemLastReadingRaw {
  value: number
  timestamp: number  // epoch ms
  var_id: number
}

export interface CemLiveValue {
  value: number | null
  time: string | null  // formatted timestamp
}
