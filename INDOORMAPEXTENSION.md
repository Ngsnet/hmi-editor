# HMI Canvas Editor – Indoor Mapa s Facility Management (Rozšíření)

## Instrukce pro Claude Code

Toto je rozšíření k hlavnímu projektu (`CLAUDE.md`) a mapovému rozšíření (`MAPEXTENSION.md`).
Implementuj až po dokončení MAPEXTENSION.md (Leaflet + SVG overlay infrastruktura již existuje).

Neměň nic z předchozích fází. Pouze rozšiřuj – přidávej nové soubory a minimálně uprav stávající.

---

## Koncept

Facility management systém pro správce budovy/obchodního centra.
Zobrazuje půdorys budovy jako interaktivní SVG vrstvu nad OpenStreetMap.
Každá obchodní jednotka (místnost) má:
- základní údaje (nájemník, plocha, patro)
- live hodnoty měřidel (vodoměr, elektroměr, kalorimetr chladu, kalorimetr tepla)
- vizuální indikaci stavu (barva výplně dle spotřeby / alertů)

Toto rozšíření přidává **třetí mód** do přepínače módů v toolbaru:
```
[ Diagram mód ]  [ Mapa mód ]  [ Indoor mód ]
```

---

## Nové datové typy (src/types/indoor.ts)

```typescript
export type FloorId = 'BL' | 'GL' | 'L1' | 'L2'  // rozšiř dle budovy

export type MeterType = 'water' | 'electric' | 'cooling' | 'heating'

export interface MeterConfig {
  deviceId: string        // ID zařízení v IoT systému
  endpoint: string        // REST API endpoint, nebo 'mock://water' atd.
  valueKey: string        // klíč v JSON odpovědi, např. 'value'
  unit: string            // 'm³', 'kWh', 'GJ', 'MWh'
  interval: number        // polling interval v ms, doporučeno 30000–60000
  alertThreshold?: number // překročení = vizuální alert na půdorysu
  dailyLimit?: number     // denní limit spotřeby pro progress bar
}

export interface Unit {
  id: string
  name: string            // název nájemníka, např. "Nike"
  svgPathId: string       // id atribut elementu v SVG půdorysu, např. "unit-42"
  floor: FloorId
  area: number            // plocha v m²
  tenant: string          // obchodní název
  category: UnitCategory
  contactEmail?: string
  contractEnd?: string    // datum konce nájmu ISO string
  meters: Partial<Record<MeterType, MeterConfig>>
}

export type UnitCategory =
  | 'fashion' | 'sport' | 'food' | 'services' | 'empty' | 'technical'

export interface FloorPlan {
  id: FloorId
  label: string           // 'Ground Level', 'Level 1', ...
  svgPath: string         // cesta k SVG souboru, např. '/floorplans/GL.svg'
  order: number           // pořadí v přepínači (0 = nejnižší)
}

export interface Building {
  id: string
  name: string
  floors: FloorPlan[]
  units: Unit[]
  geoCenter: [number, number]   // [lat, lng] střed budovy pro Leaflet
  geoZoom: number               // výchozí zoom Leaflet mapy
}
```

---

## Nové soubory

```
src/
├── components/
│   └── indoor/
│       ├── IndoorView.vue          # Hlavní komponenta indoor módu
│       ├── FloorPlanLayer.vue      # SVG půdorys jednoho patra
│       ├── UnitOverlay.vue         # Barevné stavy + hover zóny na půdorysu
│       ├── UnitPanel.vue           # Boční panel s detailem jednotky
│       ├── MeterWidget.vue         # Jeden řádek měřidla v panelu
│       └── FloorSwitcher.vue       # Přepínač pater (GL / L1 / BL)
├── composables/
│   └── useIndoorMap.ts             # Správa půdorysu, výběr jednotky, stavy
├── stores/
│   └── buildingStore.ts            # Building, Unit[], live meter hodnoty
└── types/
    └── indoor.ts                   # Datové typy (viz výše)
```

---

## buildingStore.ts (Pinia)

```typescript
// State:
// building: Building | null
// selectedUnitId: string | null
// activeFloor: FloorId
// meterValues: Map<string, number>   // klíč = `${unitId}:${meterType}`
// meterAlerts: Set<string>           // jednotky s překročeným prahem

// Actions:
// loadBuilding(building: Building): void
// selectUnit(id: string | null): void
// setActiveFloor(floor: FloorId): void
// registerAllMeters(): void
//   - projde všechny units a všechna meters
//   - pro každý MeterConfig zavolá liveDataStore.registerPoller()
// getMeterValue(unitId, meterType): number | null
// getUnitStatus(unitId): 'normal' | 'alert' | 'empty' | 'no-data'
//   - 'alert' pokud jakékoliv měřidlo překročilo alertThreshold
//   - 'empty' pokud unit.category === 'empty'
//   - 'no-data' pokud žádná data nejsou k dispozici

// Persistence:
// Definice budovy (Building + Unit[]) ukládej jako JSON do localStorage
// nebo načítej ze statického souboru /public/building.json

// Mock data:
// Pokud endpoint začíná 'mock://', generuj náhodné hodnoty:
//   mock://water    → 0.1 + Math.random() * 2      (m³/h průtok)
//   mock://electric → 10 + Math.random() * 50       (kWh)
//   mock://cooling  → 0.5 + Math.random() * 3       (GJ)
//   mock://heating  → 1 + Math.random() * 5         (GJ)
```

---

## IndoorView.vue

```
Hlavní komponenta indoor módu. Zobrazuje se když mode === 'indoor'.

Struktura:
  <div class="indoor-view" style="display:flex; width:100%; height:100%">

    <!-- Levá část: mapa s půdorysem -->
    <div class="map-area" style="flex:1; position:relative">
      <div ref="mapEl" style="width:100%; height:100%"/>  ← Leaflet podklad
      <FloorPlanLayer :floor="activeFloor" />              ← SVG půdorys
      <UnitOverlay />                                      ← barevné zóny
      <FloorSwitcher />                                    ← patra vpravo
    </div>

    <!-- Pravá část: detail jednotky (zobrazí se při výběru) -->
    <UnitPanel
      v-if="selectedUnit"
      :unit="selectedUnit"
      @close="buildingStore.selectUnit(null)"
    />

  </div>

onMounted:
  1. Inicializuj Leaflet s OSM podkladem (stejně jako MapView.vue)
  2. Nastav pohled na building.geoCenter, building.geoZoom
  3. buildingStore.registerAllMeters()

Leaflet v indoor módu slouží jen jako orientační podklad – uživatel vidí
okolí budovy. Samotný půdorys je SVG overlay přes celou plochu mapy.
Při přiblížení na zoom >= 17 skryj Leaflet tiles a zobraz jen půdorys
(volitelné vylepšení).
```

---

## FloorPlanLayer.vue

```
SVG overlay přesně nad Leaflet mapou (position: absolute, 100% x 100%).

Načítá SVG soubor aktivního patra: /public/floorplans/{floor}.svg
Zobrazuje ho jako inline SVG (ne <img> tag – potřebujeme přístup k DOM elementům).

Způsob načtení:
  const response = await fetch(`/floorplans/${floor}.svg`)
  const svgText = await response.text()
  containerEl.innerHTML = svgText  // vloží SVG přímo do DOM

SVG půdorys musí být připraven takto:
  - Každá obchodní jednotka = <path id="unit-{id}"> nebo <polygon id="unit-{id}">
  - Chodby, stěny, technické prostory = bez id nebo s prefixem "wall-", "corridor-"
  - ViewBox odpovídá logickým souřadnicím půdorysu (ne GPS)

Transformace SVG na GPS souřadnice:
  Půdorys je statický obrázek přichycený ke dvěma referenčním GPS bodům.
  Definuj v Building:
    geoRef: [
      { svgX: 0,    svgY: 0,    lat: 50.0512, lng: 14.5234 },  // levý horní roh
      { svgX: 1000, svgY: 800,  lat: 50.0498, lng: 14.5267 }   // pravý dolní roh
    ]
  Přepočet: affine transform mezi SVG coords a GPS coords.
  SVG overlay pak pozicuj přes Leaflet L.SVGOverlay nebo CSS transform.

Nejjednodušší přístup pro začátek:
  Ignoruj GPS přesnost, zobraz SVG jako fullscreen overlay nad mapou
  a přidej manuální kalibraci (posun + škálování) v nastavení budovy.
```

---

## UnitOverlay.vue

```
Překryvná vrstva která mění vizuální styl jednotek dle live dat.
Pracuje přímo s DOM elementy načteného SVG půdorysu.

Po načtení SVG půdorysu (FloorPlanLayer emituje 'loaded'):
  Pro každou unit v buildingStore.building.units:
    const pathEl = document.getElementById(unit.svgPathId)
    if (pathEl) applyUnitStyle(pathEl, unit)

applyUnitStyle(el, unit):
  const status = buildingStore.getUnitStatus(unit.id)
  switch(status) {
    case 'normal':  el.style.fill = 'rgba(34, 197, 94, 0.25)'   // zelená
    case 'alert':   el.style.fill = 'rgba(239, 68, 68, 0.4)'    // červená
    case 'empty':   el.style.fill = 'rgba(156, 163, 175, 0.2)'  // šedá
    case 'no-data': el.style.fill = 'rgba(251, 191, 36, 0.25)'  // žlutá
  }
  el.style.cursor = 'pointer'
  el.style.stroke = '#374151'
  el.style.strokeWidth = '1px'
  el.style.transition = 'fill 0.3s ease'

Hover efekt:
  el.addEventListener('mouseenter', () => el.style.fillOpacity = '0.6')
  el.addEventListener('mouseleave', () => applyUnitStyle(el, unit))

Click:
  el.addEventListener('click', () => buildingStore.selectUnit(unit.id))

Reaktivita:
  Watch na buildingStore.meterAlerts → přebarvi affected jednotky
  Watch na buildingStore.activeFloor → přeaplikuj styly po přepnutí patra
```

---

## UnitPanel.vue

```
Boční panel zobrazující detail vybrané jednotky.
Šířka: 320px, výška: 100%, position: relative (ne absolute).
Zobrazí se vedle mapy (ne přes mapu).

Struktura panelu:

  ┌─────────────────────────────────────────┐
  │  [×]  Nike                              │  ← název + zavřít
  │  Jednotka GL-42  ·  285 m²  ·  Fashion  │  ← metadata
  ├─────────────────────────────────────────┤
  │  MĚŘIDLA                                │
  │  [MeterWidget water]                    │
  │  [MeterWidget electric]                 │
  │  [MeterWidget cooling]                  │
  │  [MeterWidget heating]                  │
  ├─────────────────────────────────────────┤
  │  INFORMACE                              │
  │  Nájemník: Nike Czech s.r.o.            │
  │  Konec nájmu: 31. 12. 2026              │
  │  Kontakt: info@nike-cz.com              │
  ├─────────────────────────────────────────┤
  │  [Detail spotřeby]  [Nastavení měřidel] │
  └─────────────────────────────────────────┘

Pokud jednotka nemá žádná měřidla konfigurována:
  Zobraz zprávu "Žádná měřidla nejsou nakonfigurována"
  a tlačítko "Přidat měřidlo" → otevře konfigurační dialog

Zobraz jen ta měřidla která unit.meters obsahuje
(ne všechna 4 vždy – jednotka nemusí mít všechny typy).
```

---

## MeterWidget.vue

```
Jeden řádek měřidla v UnitPanel.

Props:
  unitId: string
  meterType: MeterType
  config: MeterConfig

Struktura jednoho řádku:
  [ikona]  [název]     [hodnota + jednotka]  [trend]
  💧       Vodoměr     12.4 m³               ↑ 0.3

Ikony dle typu (SVG nebo unicode):
  water:    💧 (nebo SVG kapka)
  electric: ⚡ (nebo SVG blesk)
  cooling:  🔵 (nebo SVG sněhová vločka)
  heating:  🔴 (nebo SVG plamen)

Hodnota: buildingStore.getMeterValue(unitId, meterType)
  Pokud null → zobraz '--'
  Pokud číslo → zaokrouhli na 1 desetinné místo + unit

Trend (volitelný):
  Porovnej poslední 2 hodnoty z historie (drž v komponentě posledních 10 hodnot)
  ↑ červeně pokud roste, ↓ zeleně pokud klesá, → šedě pokud stagnuje

Progress bar (volitelný, pokud config.dailyLimit je nastaven):
  Tenký progress bar pod hodnotou ukazující % denního limitu
  Barva: zelená < 70%, oranžová 70–90%, červená > 90%

Polling:
  MeterWidget sám NESPOUŠTÍ polling – o to se stará buildingStore.registerAllMeters()
  MeterWidget jen čte hodnoty z buildingStore.getMeterValue()
```

---

## FloorSwitcher.vue

```
Přepínač pater, pozice: absolute, vpravo nahoře nad mapou.
Stejný vizuální styl jako na Fashion Arena webu (svislý seznam tlačítek).

<div style="position:absolute; top:16px; right:16px; z-index:1000">
  <button
    v-for="floor in building.floors"
    :key="floor.id"
    :class="{ active: activeFloor === floor.id }"
    @click="buildingStore.setActiveFloor(floor.id)"
  >
    {{ floor.id }}
  </button>
</div>

Aktivní patro = tmavé tlačítko (jako ve screenshotu GL).
Při přepnutí patra:
  1. Načti nový SVG půdorys (FloorPlanLayer)
  2. Přeaplikuj styly (UnitOverlay)
  3. Nezměň Leaflet pohled (mapa zůstane stejná)
```

---

## useIndoorMap.ts

```typescript
// Composable pro pomocné funkce indoor módu.

// svgToLatLng(svgX, svgY, geoRef): [lat, lng]
//   Affine transformace z SVG souřadnic na GPS.
//   Potřebné pro přesné umístění SVG overlay na Leaflet mapu.
//   Výpočet:
//     scaleX = (ref[1].lng - ref[0].lng) / (ref[1].svgX - ref[0].svgX)
//     scaleY = (ref[1].lat - ref[0].lat) / (ref[1].svgY - ref[0].svgY)
//     lat = ref[0].lat + (svgY - ref[0].svgY) * scaleY
//     lng = ref[0].lng + (svgX - ref[0].svgX) * scaleX

// getUnitFromSvgId(svgPathId): Unit | null
//   Najde Unit podle svgPathId.

// formatMeterValue(value, unit): string
//   Formátuje hodnotu měřidla pro zobrazení.
//   Příklady: 12.4 m³, 847 kWh, 3.2 GJ

// exportUnitReport(unitId): void
//   Vygeneruje JSON report spotřeby dané jednotky.
//   (implementuj jako stažení JSON souboru)
```

---

## CMS – Správa budovy a jednotek

Přidej admin rozhraní dostupné přes `/admin` route (Vue Router).
Není nutná autentizace pro prototyp – přidej ji později.

### Admin stránky

```
/admin                    → přehled budov (v1: jen jedna budova)
/admin/building           → nastavení budovy (název, GPS střed, podlaží)
/admin/units              → seznam všech jednotek, bulk edit
/admin/units/:id          → detail a editace jednotky
/admin/units/:id/meters   → konfigurace měřidel jednotky
/admin/floorplans         → nahrání SVG půdorysů pro každé patro
```

### AdminUnitForm.vue

```
Formulář pro editaci Unit.
Pole:
  - Název nájemníka (text input)
  - Kategorie (select: fashion/sport/food/services/empty/technical)
  - Plocha m² (number input)
  - Patro (select dle dostupných podlaží)
  - SVG Path ID (text input + tlačítko "Ověřit" které zkontroluje
    zda element s tímto id existuje v načteném SVG půdorysu)
  - Kontaktní email (email input)
  - Konec nájmu (date input)

Tlačítka: Uložit, Zrušit, Smazat jednotku
```

### AdminMeterForm.vue

```
Konfigurace měřidel pro jednu jednotku.
Pro každý typ měřidla (water, electric, cooling, heating) zobraz sekci:

  [checkbox] Vodoměr
  Pokud zaškrtnut, zobraz:
    - Device ID (text)
    - API endpoint (text, např. '/api/meters/water/42' nebo 'mock://water')
    - Value key (text, výchozí 'value')
    - Jednotka (select: m³, kWh, GJ, MWh)
    - Polling interval (select: 10s, 30s, 60s, 5min)
    - Alert threshold (number, volitelné)
    - Denní limit (number, volitelné)
    - Tlačítko "Test" → provede jednorázový fetch a zobrazí výsledek

Uložit ukládá celý Unit.meters objekt.
```

### AdminFloorPlanUpload.vue

```
Upload SVG půdorysu pro dané patro.
  - Select pro výběr patra
  - File input pro SVG soubor (accept=".svg")
  - Po uploadu zobraz SVG preview
  - Zobraz seznam nalezených id atributů (unit-* prefix)
  - Porovnej s Unit.svgPathId v databázi → zvýrazni nepárované id

SVG soubory ukládej do /public/floorplans/{floorId}.svg
```

---

## Příprava SVG půdorysu

Toto je manuální krok který Claude Code neudělá – je to práce v grafickém editoru.

### Postup pro vytvoření SVG půdorysu

1. Získej půdorys budovy (PDF od správce, screenshot z Google Maps, vlastní měření)
2. Otevři v **Inkscape** (zdarma) nebo Adobe Illustrator
3. Překresli nebo vektorizuj každou obchodní jednotku jako samostatný `<path>` nebo `<polygon>`
4. Každé jednotce nastav atribut `id="unit-{číslo}"` (např. `id="unit-42"`)
5. Chodby, stěny, atria nakresli bez id nebo s prefixem `id="wall-..."`, `id="corridor-..."`
6. Exportuj jako čisté SVG (bez Inkscape metadat: File → Clean Up Document)
7. Nahraj přes AdminFloorPlanUpload

### Konvence SVG id

```
unit-{id}         obchodní jednotka (klikací, měřidla)
wall-{n}          zeď / fasáda (neklikací)
corridor-{n}      chodba / atrium (neklikací)
technical-{n}     technická místnost (neklikací)
entrance-{n}      vchod (neklikací)
```

### Demo SVG pro vývoj

Pokud reálný půdorys není k dispozici, vytvoř zjednodušený demo půdorys:
```svg
<svg viewBox="0 0 1000 800" xmlns="http://www.w3.org/2000/svg">
  <!-- Vnější obrys budovy -->
  <rect x="50" y="50" width="900" height="700" fill="#f5f5f0" stroke="#999" stroke-width="3"/>

  <!-- Chodba -->
  <rect id="corridor-main" x="100" y="100" width="800" height="80"
        fill="#e8e8e0" stroke="#ccc" stroke-width="1"/>

  <!-- Obchodní jednotky – horní řada -->
  <rect id="unit-01" x="100" y="200" width="160" height="120"
        fill="#fff" stroke="#999" stroke-width="1"/>
  <rect id="unit-02" x="280" y="200" width="160" height="120"
        fill="#fff" stroke="#999" stroke-width="1"/>
  <rect id="unit-03" x="460" y="200" width="160" height="120"
        fill="#fff" stroke="#999" stroke-width="1"/>
  <rect id="unit-04" x="640" y="200" width="160" height="120"
        fill="#fff" stroke="#999" stroke-width="1"/>

  <!-- Obchodní jednotky – dolní řada -->
  <rect id="unit-05" x="100" y="480" width="200" height="150"
        fill="#fff" stroke="#999" stroke-width="1"/>
  <rect id="unit-06" x="320" y="480" width="200" height="150"
        fill="#fff" stroke="#999" stroke-width="1"/>
  <rect id="unit-07" x="540" y="480" width="200" height="150"
        fill="#fff" stroke="#999" stroke-width="1"/>
</svg>
```

Nahraj jako `/public/floorplans/GL.svg`.

---

## Demo data (src/data/demoBuilding.ts)

```typescript
export const demoBuilding: Building = {
  id: 'demo-center',
  name: 'Demo Obchodní Centrum',
  geoCenter: [50.0505, 14.5250],
  geoZoom: 17,
  floors: [
    { id: 'BL', label: 'Basement', svgPath: '/floorplans/BL.svg', order: 0 },
    { id: 'GL', label: 'Ground Level', svgPath: '/floorplans/GL.svg', order: 1 },
    { id: 'L1', label: 'Level 1', svgPath: '/floorplans/L1.svg', order: 2 },
  ],
  units: [
    {
      id: 'unit-01',
      name: 'Nike',
      svgPathId: 'unit-01',
      floor: 'GL',
      area: 285,
      tenant: 'Nike Czech s.r.o.',
      category: 'sport',
      contractEnd: '2026-12-31',
      meters: {
        water:    { deviceId: 'w-01', endpoint: 'mock://water',    valueKey: 'value', unit: 'm³',  interval: 30000 },
        electric: { deviceId: 'e-01', endpoint: 'mock://electric', valueKey: 'value', unit: 'kWh', interval: 30000, alertThreshold: 900, dailyLimit: 1000 },
        cooling:  { deviceId: 'c-01', endpoint: 'mock://cooling',  valueKey: 'value', unit: 'GJ',  interval: 60000 },
        heating:  { deviceId: 'h-01', endpoint: 'mock://heating',  valueKey: 'value', unit: 'GJ',  interval: 60000 },
      }
    },
    {
      id: 'unit-02',
      name: 'Puma',
      svgPathId: 'unit-02',
      floor: 'GL',
      area: 210,
      tenant: 'Puma SE',
      category: 'sport',
      meters: {
        water:    { deviceId: 'w-02', endpoint: 'mock://water',    valueKey: 'value', unit: 'm³',  interval: 30000 },
        electric: { deviceId: 'e-02', endpoint: 'mock://electric', valueKey: 'value', unit: 'kWh', interval: 30000 },
        heating:  { deviceId: 'h-02', endpoint: 'mock://heating',  valueKey: 'value', unit: 'GJ',  interval: 60000 },
      }
    },
    {
      id: 'unit-03',
      name: 'Volná jednotka',
      svgPathId: 'unit-03',
      floor: 'GL',
      area: 180,
      tenant: '',
      category: 'empty',
      meters: {}
    },
    // ... přidej další jednotky pro každý svgPathId v demo SVG
  ]
}
```

---

## Úpravy stávajících souborů

### EditorLayout.vue

```typescript
// Přidej třetí mód:
type AppMode = 'diagram' | 'map' | 'indoor'
const mode = ref<AppMode>('diagram')

// V template:
<CanvasView  v-if="mode === 'diagram'" />
<MapView     v-else-if="mode === 'map'" />
<IndoorView  v-else />
```

### Toolbar.vue

```
Přidej tlačítko Indoor:
  <button @click="mode = 'indoor'" :class="{ active: mode === 'indoor' }">
    Indoor
  </button>

V indoor módu skryj všechny diagram a map nástroje.
Zobraz pouze:
  - přepínač módů
  - odkaz do admin rozhraní (ikona ozubeného kola → /admin)
```

### main.ts / router

```typescript
// Přidej Vue Router pokud ještě není:
import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/',       component: () => import('./App.vue') },
    { path: '/admin',  component: () => import('./pages/AdminLayout.vue') },
    { path: '/admin/units/:id', component: () => import('./pages/AdminUnitDetail.vue') },
  ]
})
```

---

## Co NENÍ v scope tohoto rozšíření

- Historické grafy spotřeby (přidej jako další rozšíření)
- Export reportů do PDF/Excel
- Emailové notifikace při překročení prahu
- Autentizace admin rozhraní
- Více budov (v1 počítej s jednou budovou)
- 3D zobrazení pater
- Navigace a wayfinding (trasy pro návštěvníky)
- Integrace s konkrétním IoT protokolem (MQTT, Modbus) – řeší backend, ne tento frontend
