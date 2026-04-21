/**
 * CEM API function IDs. Single endpoint with `?id=X` parameter.
 * Base URL configured in src/services/config.ts
 */
export const CEM_API_IDS = {
  /** GET - Objects list (mis_id, depth) → hierarchical object tree */
  OBJECTS: 106,
  /** GET - Meters list (mis_id) → meters for an object */
  METERS: 108,
  /** GET - Counters (variables) for meters → counter details with last values */
  COUNTERS: 107,
  /** GET - Counter types (pot_id mapping) → type definitions with units and colors */
  COUNTER_TYPES: 222,
  /** GET - Last reading for counters (var_id or JSON array) → value, timestamp, var_id */
  LAST_READING: 8,
  /** GET - Raw readings for single counter (var_id, from, to, alg) → value, timestamp */
  SINGLE_READING: 3,
} as const
