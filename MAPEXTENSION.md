HMI Canvas Editor – Mapové rozšíření (Fáze 9)
Instrukce pro Claude Code
Toto je rozšíření k hlavnímu projektu popsanému v CLAUDE.md.
Implementuj až po dokončení a otestování Fáze 4 (widgety: GaugeWidget, SwitchLED, TextValue),
protože MapWidget.vue tyto komponenty přímo reusuje.
Neměň nic z Fází 1–8. Pouze rozšiřuj – přidávej nové soubory a minimálně uprav stávající.

Koncept
Aplikace dostane dva samostatné módy přepínatelné v toolbaru:

Diagram mód – stávající SVG canvas editor (Fáze 1–8), beze změny
Mapa mód – Leaflet mapa s SVG overlay pro live widgety

Módy sdílejí diagramStore – widgety (gauge, switch, textValue) s nastavenou
geoPosition jsou viditelné v obou módech. V diagramu na své x, y pozici,
na mapě přichycené ke GPS souřadnicím.

Instalace
npm install leaflet
npm install @types/leaflet  # pokud TypeScript
Do main.ts nebo index.html přidej:
import 'leaflet/dist/leaflet.css'

Rozšíření datového modelu (src/types/diagram.ts)
typescript// Přidej do rozhraní CanvasElement:
geoPosition?: {
  lat: number
  lng: number
  locked: boolean  // true = pozici nelze měnit v diagram módu, jen na mapě
}

// Přidej do rozhraní Diagram:
mapSettings?: {
  defaultCenter: [number, number]  // [lat, lng]
  defaultZoom: number
  tileProvider: 'osm' | 'google-streets' | 'google-satellite'
}

Nové soubory
src/
├── components/
│   └── map/
│       ├── MapView.vue           # Leaflet mapa + SVG overlay, hlavní komponenta
│       ├── MapWidgetOverlay.vue  # SVG vrstva nad mapou
│       └── MapWidget.vue        # Jednotlivý widget přichycený ke GPS bodu
├── composables/
│   └── useMapSync.ts            # Synchronizace Leaflet viewport → SVG screen pozice

useMapSync.ts
typescript// Composable který drží referenci na Leaflet map instanci
// a přepočítává screen pozice widgetů při každé změně viewportu mapy.

interface MapSyncState {
  map: L.Map | null
  widgetPositions: Map<string, { x: number; y: number }>  // elementId → screen px
}

// setMap(mapInstance: L.Map): void
//   - uloží referenci na mapu
//   - zaregistruje event listenery: map.on('zoom move zoomend moveend', recalculate)

// recalculate(): void
//   Pro každý element s geoPosition v diagramStore:
//     const point = map.latLngToContainerPoint([el.geoPosition.lat, el.geoPosition.lng])
//     widgetPositions.set(el.id, { x: point.x, y: point.y })

// getPosition(elementId: string): { x: number; y: number } | null
//   Vrací aktuální screen pozici widgetu nebo null pokud element nemá geoPosition.

// destroy(): void
//   Odregistruje event listenery, vymaže widgetPositions.
//   Volat v onUnmounted MapView.vue.

MapView.vue
Hlavní komponenta mapového módu. Zobrazuje se místo CanvasView když mode === 'map'.

Struktura:
  <div class="map-container" style="position:relative; width:100%; height:100%">
    <div ref="mapEl" style="width:100%; height:100%"/>   ← Leaflet se připojí sem
    <MapWidgetOverlay />                                  ← SVG overlay nad mapou
  </div>

onMounted:
  1. Inicializuj Leaflet: map = L.map(mapEl.value, { ... })
  2. Nastav tile provider dle diagram.mapSettings.tileProvider:

     OSM:
       L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
         attribution: '© OpenStreetMap contributors'
       }).addTo(map)

     Google Streets:
       L.tileLayer('https://mt1.google.com/vt/lyrs=r&x={x}&y={y}&z={z}').addTo(map)

     Google Satellite:
       L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}').addTo(map)

  3. Nastav výchozí pohled: map.setView(defaultCenter, defaultZoom)
  4. Předej instanci composablu: mapSync.setMap(map)

  5. Registruj click na mapu pro vkládání widgetů:
     map.on('click', (e) => {
       if (toolStore.activeTool je widget) {
         const { lat, lng } = e.latlng
         diagramStore.addElement({
           type: toolStore.activeTool,
           geoPosition: { lat, lng, locked: false },
           x: diagram.width / 2,   // výchozí pozice v diagram módu
           y: diagram.height / 2,
           width: 80, height: 80,
           // ... ostatní defaults
         })
       }
     })

onUnmounted:
  mapSync.destroy()
  map.remove()

MapWidgetOverlay.vue
vue<!-- SVG překryvná vrstva – renderuje pouze widgety s geoPosition -->
<!-- Musí ležet přesně nad Leaflet mapou: position absolute, plná velikost -->
<!-- pointer-events: none na SVG → proklikávání na mapu pod ním -->
<!-- pointer-events: all na jednotlivých MapWidget → interakce s widgety -->

<template>
  <svg
    style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none"
  >
    <MapWidget
      v-for="el in geoElements"
      :key="el.id"
      :element="el"
      :position="mapSync.getPosition(el.id)"
      :live-value="liveDataStore.getValue(el.dataSource)"
      @click="selectionStore.selectElement(el.id)"
    />
  </svg>
</template>

// geoElements = computed(() => diagramStore.elements.filter(el => el.geoPosition))

MapWidget.vue
Renderuje GaugeWidget / SwitchLED / TextValue přesně na GPS bodu mapy.

Props:
  element: CanvasElement
  position: { x: number; y: number } | null   ← z useMapSync
  liveValue: any

Pokud position === null → nic nerenderuj (widget je mimo viditelnou oblast mapy).

Pozice: střed widgetu = position.x, position.y
  transform="translate({position.x - element.width/2}, {position.y - element.height/2})"

Volitelná kotva (anchor line):
  Tenká čára (1px, šedá, opacity 0.5) od spodního středu widgetu
  dolů o 8px k přesnému GPS bodu → vizuální indikace přichycení.

  <line
    x1="{position.x}"
    y1="{position.y + element.height/2}"
    x2="{position.x}"
    y2="{position.y + element.height/2 + 8}"
    stroke="#666" stroke-width="1" opacity="0.5"
  />
  <circle cx="{position.x}" cy="{position.y + element.height/2 + 8}" r="2" fill="#666"/>

pointer-events: all (jinak by se widget nedal kliknout přes SVG overlay)

Reusuj přímo: <GaugeWidget>, <SwitchLED>, <TextValue> dle element.type.

Úpravy stávajících souborů
EditorLayout.vue – přidej přepínač módů
typescript// Přidej do stavu:
const mode = ref<'diagram' | 'map'>('diagram')

// V template přepínej:
<CanvasView v-if="mode === 'diagram'" />
<MapView    v-else />
Toolbar.vue – přidej přepínač a tile selector
Přidej skupinu přepínačů módu:
  <button @click="mode = 'diagram'" :class="{ active: mode === 'diagram' }">
    Diagram
  </button>
  <button @click="mode = 'map'" :class="{ active: mode === 'map' }">
    Mapa
  </button>

V mapovém módu:
  - Skryj všechny kreslící nástroje (rect, ellipse, line, polyline, text, image)
  - Zobraz pouze: select, gauge, switch, textValue
  - Zobraz tile provider select:
      <select v-model="diagram.mapSettings.tileProvider">
        <option value="osm">OpenStreetMap</option>
        <option value="google-streets">Google Streets</option>
        <option value="google-satellite">Google Satellite</option>
      </select>
    Při změně tile provideru znič a znovu vytvoř Leaflet mapu
    (nebo použij map.removeLayer + addLayer pro výměnu tile vrstvy).
PropertyPanel.vue – přidej GPS sekci
Pokud je vybrán element s geoPosition, zobraz sekci "GPS pozice":
  - Lat input (number, krok 0.000001, 6 desetinných míst)
  - Lng input (number, krok 0.000001, 6 desetinných míst)
  - Checkbox "Uzamknout pozici v diagramu" → geoPosition.locked
  - Tlačítko "Odebrat GPS" → smaže geoPosition, element zůstane jen v diagramu

Pokud není vybrán žádný element a mode === 'map', zobraz sekci "Nastavení mapy":
  - Default center: dva number inputy (lat, lng)
  - Default zoom: number input (1–20)
  - Tile provider: select (stejný jako v toolbaru)

Poznámky k implementaci

Leaflet inicializuj vždy až v onMounted – nikdy ne v setup(), potřebuje existující DOM element
Při přepnutí zpět do diagram módu Leaflet musí být zničen (map.remove()) – jinak leakuje event listenery a paměť
Google Maps tile URL funguje bez API klíče pro osobní/dev použití (neoficiální endpoint). Pro produkci použij OSM nebo oficiální Google Maps JS API s klíčem
Leaflet a Vue reaktivita nesdílejí render loop – vždy synchronizuj pozice přes useMapSync.recalculate(), nikdy nečti Leaflet stav přímo v computed properties
Při přidání nového elementu s geoPosition zavolej mapSync.recalculate() aby se ihned zobrazil na správné pozici
