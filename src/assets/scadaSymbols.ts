export interface ScadaSymbol {
  id: string
  name: string
  category: string
  width: number
  height: number
  svg: string
}

export const scadaSymbols: ScadaSymbol[] = [
  // === Valves ===
  {
    id: 'valve-gate',
    name: 'Gate Valve',
    category: 'Valves',
    width: 60, height: 60,
    svg: `<svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
      <line x1="0" y1="30" x2="20" y2="30" stroke="#333" stroke-width="3"/>
      <line x1="40" y1="30" x2="60" y2="30" stroke="#333" stroke-width="3"/>
      <polygon points="20,15 40,30 20,45" fill="none" stroke="#333" stroke-width="2"/>
      <polygon points="40,15 20,30 40,45" fill="none" stroke="#333" stroke-width="2"/>
      <line x1="30" y1="15" x2="30" y2="5" stroke="#333" stroke-width="2"/>
      <rect x="24" y="2" width="12" height="6" fill="#333" rx="1"/>
    </svg>`,
  },
  {
    id: 'valve-ball',
    name: 'Ball Valve',
    category: 'Valves',
    width: 60, height: 50,
    svg: `<svg viewBox="0 0 60 50" xmlns="http://www.w3.org/2000/svg">
      <line x1="0" y1="25" x2="18" y2="25" stroke="#333" stroke-width="3"/>
      <line x1="42" y1="25" x2="60" y2="25" stroke="#333" stroke-width="3"/>
      <circle cx="30" cy="25" r="12" fill="none" stroke="#333" stroke-width="2"/>
      <line x1="30" y1="13" x2="30" y2="37" stroke="#333" stroke-width="2"/>
    </svg>`,
  },
  {
    id: 'valve-check',
    name: 'Check Valve',
    category: 'Valves',
    width: 60, height: 50,
    svg: `<svg viewBox="0 0 60 50" xmlns="http://www.w3.org/2000/svg">
      <line x1="0" y1="25" x2="20" y2="25" stroke="#333" stroke-width="3"/>
      <line x1="40" y1="25" x2="60" y2="25" stroke="#333" stroke-width="3"/>
      <polygon points="20,10 40,25 20,40" fill="none" stroke="#333" stroke-width="2"/>
      <line x1="40" y1="10" x2="40" y2="40" stroke="#333" stroke-width="2"/>
    </svg>`,
  },
  {
    id: 'valve-3way',
    name: '3-Way Valve',
    category: 'Valves',
    width: 60, height: 60,
    svg: `<svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
      <line x1="0" y1="30" x2="15" y2="30" stroke="#333" stroke-width="3"/>
      <line x1="45" y1="30" x2="60" y2="30" stroke="#333" stroke-width="3"/>
      <line x1="30" y1="45" x2="30" y2="60" stroke="#333" stroke-width="3"/>
      <polygon points="15,18 45,30 15,42" fill="none" stroke="#333" stroke-width="2"/>
      <polygon points="45,18 15,30 45,42" fill="none" stroke="#333" stroke-width="2"/>
      <line x1="30" y1="18" x2="30" y2="8" stroke="#333" stroke-width="2"/>
      <rect x="24" y="4" width="12" height="6" fill="#333" rx="1"/>
    </svg>`,
  },

  // === Pumps ===
  {
    id: 'pump-centrifugal',
    name: 'Centrifugal Pump',
    category: 'Pumps',
    width: 70, height: 60,
    svg: `<svg viewBox="0 0 70 60" xmlns="http://www.w3.org/2000/svg">
      <circle cx="35" cy="30" r="20" fill="none" stroke="#333" stroke-width="2"/>
      <line x1="0" y1="30" x2="15" y2="30" stroke="#333" stroke-width="3"/>
      <line x1="35" y1="10" x2="70" y2="10" stroke="#333" stroke-width="3"/>
      <line x1="35" y1="10" x2="35" y2="12" stroke="#333" stroke-width="3"/>
      <polygon points="25,22 45,30 25,38" fill="#333" opacity="0.3"/>
    </svg>`,
  },
  {
    id: 'pump-positive',
    name: 'Positive Disp. Pump',
    category: 'Pumps',
    width: 70, height: 60,
    svg: `<svg viewBox="0 0 70 60" xmlns="http://www.w3.org/2000/svg">
      <circle cx="35" cy="30" r="20" fill="none" stroke="#333" stroke-width="2"/>
      <line x1="0" y1="30" x2="15" y2="30" stroke="#333" stroke-width="3"/>
      <line x1="55" y1="30" x2="70" y2="30" stroke="#333" stroke-width="3"/>
      <polygon points="25,22 45,30 25,38" fill="#333" opacity="0.3"/>
      <line x1="20" y1="15" x2="50" y2="45" stroke="#333" stroke-width="1.5"/>
    </svg>`,
  },

  // === Motors & Drives ===
  {
    id: 'motor',
    name: 'Motor',
    category: 'Drives',
    width: 60, height: 50,
    svg: `<svg viewBox="0 0 60 50" xmlns="http://www.w3.org/2000/svg">
      <circle cx="30" cy="25" r="20" fill="none" stroke="#333" stroke-width="2"/>
      <text x="30" y="25" text-anchor="middle" dominant-baseline="central" font-size="16" font-weight="bold" fill="#333">M</text>
      <line x1="50" y1="25" x2="60" y2="25" stroke="#333" stroke-width="3"/>
    </svg>`,
  },
  {
    id: 'vfd',
    name: 'VFD Drive',
    category: 'Drives',
    width: 60, height: 60,
    svg: `<svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
      <rect x="5" y="5" width="50" height="50" fill="none" stroke="#333" stroke-width="2" rx="3"/>
      <text x="30" y="25" text-anchor="middle" font-size="12" font-weight="bold" fill="#333">VFD</text>
      <polyline points="12,42 20,32 28,42 36,32 44,42" fill="none" stroke="#333" stroke-width="1.5"/>
    </svg>`,
  },
  {
    id: 'fan',
    name: 'Fan',
    category: 'Drives',
    width: 60, height: 60,
    svg: `<svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
      <circle cx="30" cy="30" r="25" fill="none" stroke="#333" stroke-width="2"/>
      <circle cx="30" cy="30" r="4" fill="#333"/>
      <path d="M 30 26 Q 38 15, 30 8 Q 22 15, 30 26" fill="#333" opacity="0.5"/>
      <path d="M 34 30 Q 45 22, 52 30 Q 45 38, 34 30" fill="#333" opacity="0.5"/>
      <path d="M 30 34 Q 22 45, 30 52 Q 38 45, 30 34" fill="#333" opacity="0.5"/>
      <path d="M 26 30 Q 15 38, 8 30 Q 15 22, 26 30" fill="#333" opacity="0.5"/>
    </svg>`,
  },

  // === Tanks & Vessels ===
  {
    id: 'tank',
    name: 'Tank',
    category: 'Tanks',
    width: 60, height: 80,
    svg: `<svg viewBox="0 0 60 80" xmlns="http://www.w3.org/2000/svg">
      <path d="M 5 15 Q 5 5 30 5 Q 55 5 55 15 L 55 65 Q 55 75 30 75 Q 5 75 5 65 Z" fill="none" stroke="#333" stroke-width="2"/>
      <ellipse cx="30" cy="15" rx="25" ry="10" fill="none" stroke="#333" stroke-width="2"/>
      <rect x="8" y="45" width="44" height="20" fill="#4a90d9" opacity="0.3" rx="2"/>
    </svg>`,
  },
  {
    id: 'tank-horizontal',
    name: 'Horizontal Tank',
    category: 'Tanks',
    width: 90, height: 50,
    svg: `<svg viewBox="0 0 90 50" xmlns="http://www.w3.org/2000/svg">
      <path d="M 15 5 L 75 5 Q 88 5 88 25 Q 88 45 75 45 L 15 45 Q 2 45 2 25 Q 2 5 15 5" fill="none" stroke="#333" stroke-width="2"/>
      <rect x="5" y="25" width="80" height="18" fill="#4a90d9" opacity="0.3" rx="2"/>
      <line x1="15" y1="5" x2="15" y2="45" stroke="#333" stroke-width="1" stroke-dasharray="4 2"/>
      <line x1="75" y1="5" x2="75" y2="45" stroke="#333" stroke-width="1" stroke-dasharray="4 2"/>
    </svg>`,
  },

  // === Instruments ===
  {
    id: 'sensor-temp',
    name: 'Temperature Sensor',
    category: 'Instruments',
    width: 50, height: 50,
    svg: `<svg viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg">
      <circle cx="25" cy="25" r="20" fill="none" stroke="#333" stroke-width="2"/>
      <text x="25" y="20" text-anchor="middle" font-size="12" font-weight="bold" fill="#333">TT</text>
      <line x1="18" y1="28" x2="32" y2="28" stroke="#333" stroke-width="1"/>
      <text x="25" y="38" text-anchor="middle" font-size="9" fill="#666">101</text>
    </svg>`,
  },
  {
    id: 'sensor-pressure',
    name: 'Pressure Sensor',
    category: 'Instruments',
    width: 50, height: 50,
    svg: `<svg viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg">
      <circle cx="25" cy="25" r="20" fill="none" stroke="#333" stroke-width="2"/>
      <text x="25" y="20" text-anchor="middle" font-size="12" font-weight="bold" fill="#333">PT</text>
      <line x1="18" y1="28" x2="32" y2="28" stroke="#333" stroke-width="1"/>
      <text x="25" y="38" text-anchor="middle" font-size="9" fill="#666">102</text>
    </svg>`,
  },
  {
    id: 'sensor-flow',
    name: 'Flow Sensor',
    category: 'Instruments',
    width: 50, height: 50,
    svg: `<svg viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg">
      <circle cx="25" cy="25" r="20" fill="none" stroke="#333" stroke-width="2"/>
      <text x="25" y="20" text-anchor="middle" font-size="12" font-weight="bold" fill="#333">FT</text>
      <line x1="18" y1="28" x2="32" y2="28" stroke="#333" stroke-width="1"/>
      <text x="25" y="38" text-anchor="middle" font-size="9" fill="#666">103</text>
    </svg>`,
  },
  {
    id: 'sensor-level',
    name: 'Level Sensor',
    category: 'Instruments',
    width: 50, height: 50,
    svg: `<svg viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg">
      <circle cx="25" cy="25" r="20" fill="none" stroke="#333" stroke-width="2"/>
      <text x="25" y="20" text-anchor="middle" font-size="12" font-weight="bold" fill="#333">LT</text>
      <line x1="18" y1="28" x2="32" y2="28" stroke="#333" stroke-width="1"/>
      <text x="25" y="38" text-anchor="middle" font-size="9" fill="#666">104</text>
    </svg>`,
  },

  // === Meters ===
  {
    id: 'meter-electric',
    name: 'Electricity Meter',
    category: 'Meters',
    width: 60, height: 70,
    svg: `<svg viewBox="0 0 60 70" xmlns="http://www.w3.org/2000/svg">
      <rect x="5" y="5" width="50" height="55" rx="4" fill="none" stroke="#333" stroke-width="2"/>
      <circle cx="30" cy="28" r="14" fill="none" stroke="#333" stroke-width="1.5"/>
      <text x="30" y="28" text-anchor="middle" dominant-baseline="central" font-size="11" font-weight="bold" fill="#333">kWh</text>
      <rect x="12" y="48" width="36" height="8" rx="1" fill="#333" opacity="0.15"/>
      <text x="30" y="52" text-anchor="middle" dominant-baseline="central" font-size="7" font-family="monospace" fill="#333">00000.0</text>
      <line x1="20" y1="60" x2="20" y2="68" stroke="#333" stroke-width="2"/>
      <line x1="40" y1="60" x2="40" y2="68" stroke="#333" stroke-width="2"/>
    </svg>`,
  },
  {
    id: 'meter-electric-3ph',
    name: '3-Phase Meter',
    category: 'Meters',
    width: 60, height: 70,
    svg: `<svg viewBox="0 0 60 70" xmlns="http://www.w3.org/2000/svg">
      <rect x="5" y="5" width="50" height="55" rx="4" fill="none" stroke="#333" stroke-width="2"/>
      <circle cx="30" cy="25" r="12" fill="none" stroke="#333" stroke-width="1.5"/>
      <text x="30" y="22" text-anchor="middle" font-size="8" font-weight="bold" fill="#333">3~</text>
      <text x="30" y="31" text-anchor="middle" font-size="7" fill="#333">kWh</text>
      <rect x="12" y="42" width="36" height="8" rx="1" fill="#333" opacity="0.15"/>
      <text x="30" y="46" text-anchor="middle" dominant-baseline="central" font-size="7" font-family="monospace" fill="#333">00000.0</text>
      <line x1="15" y1="60" x2="15" y2="68" stroke="#e53935" stroke-width="2"/>
      <line x1="30" y1="60" x2="30" y2="68" stroke="#333" stroke-width="2"/>
      <line x1="45" y1="60" x2="45" y2="68" stroke="#1565c0" stroke-width="2"/>
    </svg>`,
  },
  {
    id: 'meter-water',
    name: 'Water Meter',
    category: 'Meters',
    width: 60, height: 60,
    svg: `<svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
      <circle cx="30" cy="30" r="25" fill="none" stroke="#1565c0" stroke-width="2"/>
      <circle cx="30" cy="30" r="18" fill="none" stroke="#1565c0" stroke-width="1"/>
      <text x="30" y="26" text-anchor="middle" font-size="10" font-weight="bold" fill="#1565c0">m³</text>
      <rect x="16" y="33" width="28" height="8" rx="1" fill="#1565c0" opacity="0.15"/>
      <text x="30" y="37" text-anchor="middle" dominant-baseline="central" font-size="6" font-family="monospace" fill="#1565c0">0000.00</text>
      <line x1="0" y1="30" x2="5" y2="30" stroke="#1565c0" stroke-width="3"/>
      <line x1="55" y1="30" x2="60" y2="30" stroke="#1565c0" stroke-width="3"/>
      <path d="M 30 48 Q 33 43 30 40 Q 27 43 30 48 Z" fill="#1565c0" opacity="0.5"/>
    </svg>`,
  },
  {
    id: 'meter-water-hot',
    name: 'Hot Water Meter',
    category: 'Meters',
    width: 60, height: 60,
    svg: `<svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
      <circle cx="30" cy="30" r="25" fill="none" stroke="#e53935" stroke-width="2"/>
      <circle cx="30" cy="30" r="18" fill="none" stroke="#e53935" stroke-width="1"/>
      <text x="30" y="26" text-anchor="middle" font-size="10" font-weight="bold" fill="#e53935">m³</text>
      <rect x="16" y="33" width="28" height="8" rx="1" fill="#e53935" opacity="0.15"/>
      <text x="30" y="37" text-anchor="middle" dominant-baseline="central" font-size="6" font-family="monospace" fill="#e53935">0000.00</text>
      <line x1="0" y1="30" x2="5" y2="30" stroke="#e53935" stroke-width="3"/>
      <line x1="55" y1="30" x2="60" y2="30" stroke="#e53935" stroke-width="3"/>
      <path d="M 28 48 Q 30 43 28 40" fill="none" stroke="#e53935" stroke-width="1.2"/>
      <path d="M 32 48 Q 34 43 32 40" fill="none" stroke="#e53935" stroke-width="1.2"/>
    </svg>`,
  },
  {
    id: 'meter-calorimeter',
    name: 'Calorimeter',
    category: 'Meters',
    width: 70, height: 60,
    svg: `<svg viewBox="0 0 70 60" xmlns="http://www.w3.org/2000/svg">
      <rect x="5" y="5" width="60" height="45" rx="4" fill="none" stroke="#e65100" stroke-width="2"/>
      <text x="35" y="18" text-anchor="middle" font-size="9" font-weight="bold" fill="#e65100">CAL</text>
      <rect x="12" y="24" width="46" height="10" rx="1" fill="#e65100" opacity="0.12"/>
      <text x="35" y="29" text-anchor="middle" dominant-baseline="central" font-size="7" font-family="monospace" fill="#e65100">000.0 GJ</text>
      <line x1="0" y1="38" x2="5" y2="38" stroke="#e53935" stroke-width="3"/>
      <line x1="65" y1="38" x2="70" y2="38" stroke="#1565c0" stroke-width="3"/>
      <text x="14" y="44" font-size="6" fill="#e53935">IN</text>
      <text x="52" y="44" font-size="6" fill="#1565c0">OUT</text>
      <polyline points="25,55 28,50 31,55 34,50 37,55" fill="none" stroke="#e65100" stroke-width="1.2"/>
    </svg>`,
  },
  {
    id: 'meter-gas',
    name: 'Gas Meter',
    category: 'Meters',
    width: 60, height: 60,
    svg: `<svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
      <rect x="5" y="8" width="50" height="40" rx="5" fill="none" stroke="#f9a825" stroke-width="2"/>
      <text x="30" y="22" text-anchor="middle" font-size="10" font-weight="bold" fill="#f9a825">GAS</text>
      <rect x="12" y="30" width="36" height="10" rx="1" fill="#f9a825" opacity="0.15"/>
      <text x="30" y="35" text-anchor="middle" dominant-baseline="central" font-size="7" font-family="monospace" fill="#f9a825">0000 m³</text>
      <line x1="0" y1="28" x2="5" y2="28" stroke="#f9a825" stroke-width="3"/>
      <line x1="55" y1="28" x2="60" y2="28" stroke="#f9a825" stroke-width="3"/>
      <circle cx="30" cy="54" r="4" fill="none" stroke="#f9a825" stroke-width="1.2"/>
      <path d="M 28 56 L 30 52 L 32 56" fill="#f9a825" opacity="0.5"/>
    </svg>`,
  },

  // === Energy ===
  {
    id: 'solar-panel',
    name: 'Solar Panel',
    category: 'Energy',
    width: 80, height: 60,
    svg: `<svg viewBox="0 0 80 60" xmlns="http://www.w3.org/2000/svg">
      <rect x="5" y="5" width="70" height="45" rx="2" fill="#1565c0" fill-opacity="0.15" stroke="#1565c0" stroke-width="2"/>
      <line x1="5" y1="20" x2="75" y2="20" stroke="#1565c0" stroke-width="1"/>
      <line x1="5" y1="35" x2="75" y2="35" stroke="#1565c0" stroke-width="1"/>
      <line x1="28" y1="5" x2="28" y2="50" stroke="#1565c0" stroke-width="1"/>
      <line x1="52" y1="5" x2="52" y2="50" stroke="#1565c0" stroke-width="1"/>
      <line x1="35" y1="50" x2="30" y2="58" stroke="#333" stroke-width="2"/>
      <line x1="45" y1="50" x2="50" y2="58" stroke="#333" stroke-width="2"/>
      <line x1="26" y1="58" x2="54" y2="58" stroke="#333" stroke-width="2"/>
    </svg>`,
  },
  {
    id: 'solar-array',
    name: 'PV Array',
    category: 'Energy',
    width: 80, height: 70,
    svg: `<svg viewBox="0 0 80 70" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="3" width="34" height="28" rx="1" fill="#1565c0" fill-opacity="0.15" stroke="#1565c0" stroke-width="1.5"/>
      <line x1="3" y1="17" x2="37" y2="17" stroke="#1565c0" stroke-width="0.8"/>
      <line x1="20" y1="3" x2="20" y2="31" stroke="#1565c0" stroke-width="0.8"/>
      <rect x="43" y="3" width="34" height="28" rx="1" fill="#1565c0" fill-opacity="0.15" stroke="#1565c0" stroke-width="1.5"/>
      <line x1="43" y1="17" x2="77" y2="17" stroke="#1565c0" stroke-width="0.8"/>
      <line x1="60" y1="3" x2="60" y2="31" stroke="#1565c0" stroke-width="0.8"/>
      <rect x="3" y="35" width="34" height="28" rx="1" fill="#1565c0" fill-opacity="0.15" stroke="#1565c0" stroke-width="1.5"/>
      <line x1="3" y1="49" x2="37" y2="49" stroke="#1565c0" stroke-width="0.8"/>
      <line x1="20" y1="35" x2="20" y2="63" stroke="#1565c0" stroke-width="0.8"/>
      <rect x="43" y="35" width="34" height="28" rx="1" fill="#1565c0" fill-opacity="0.15" stroke="#1565c0" stroke-width="1.5"/>
      <line x1="43" y1="49" x2="77" y2="49" stroke="#1565c0" stroke-width="0.8"/>
      <line x1="60" y1="35" x2="60" y2="63" stroke="#1565c0" stroke-width="0.8"/>
    </svg>`,
  },
  {
    id: 'inverter',
    name: 'Inverter',
    category: 'Energy',
    width: 60, height: 50,
    svg: `<svg viewBox="0 0 60 50" xmlns="http://www.w3.org/2000/svg">
      <rect x="5" y="5" width="50" height="40" rx="3" fill="none" stroke="#333" stroke-width="2"/>
      <text x="30" y="18" text-anchor="middle" font-size="8" fill="#333">DC → AC</text>
      <polyline points="14,32 20,25 26,35 32,25 38,35 44,28" fill="none" stroke="#4caf50" stroke-width="1.5"/>
      <line x1="0" y1="20" x2="5" y2="20" stroke="#e53935" stroke-width="2"/>
      <line x1="0" y1="30" x2="5" y2="30" stroke="#333" stroke-width="2"/>
      <line x1="55" y1="25" x2="60" y2="25" stroke="#4caf50" stroke-width="2"/>
      <text x="2" y="18" font-size="6" fill="#e53935">+</text>
      <text x="2" y="34" font-size="6" fill="#333">−</text>
    </svg>`,
  },
  {
    id: 'battery',
    name: 'Battery',
    category: 'Energy',
    width: 50, height: 60,
    svg: `<svg viewBox="0 0 50 60" xmlns="http://www.w3.org/2000/svg">
      <rect x="18" y="2" width="14" height="5" rx="1" fill="#333"/>
      <rect x="8" y="7" width="34" height="48" rx="3" fill="none" stroke="#333" stroke-width="2"/>
      <rect x="12" y="25" width="26" height="26" rx="1" fill="#4caf50" opacity="0.3"/>
      <text x="25" y="38" text-anchor="middle" dominant-baseline="central" font-size="11" font-weight="bold" fill="#333">75%</text>
      <text x="25" y="16" text-anchor="middle" font-size="7" fill="#666">BAT</text>
    </svg>`,
  },
  {
    id: 'grid-connection',
    name: 'Grid Connection',
    category: 'Energy',
    width: 50, height: 50,
    svg: `<svg viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg">
      <circle cx="25" cy="25" r="20" fill="none" stroke="#333" stroke-width="2"/>
      <line x1="25" y1="5" x2="25" y2="45" stroke="#333" stroke-width="1"/>
      <line x1="5" y1="25" x2="45" y2="25" stroke="#333" stroke-width="1"/>
      <line x1="10" y1="10" x2="40" y2="40" stroke="#333" stroke-width="0.8"/>
      <line x1="40" y1="10" x2="10" y2="40" stroke="#333" stroke-width="0.8"/>
      <path d="M 22 15 L 25 8 L 28 15" fill="none" stroke="#f9a825" stroke-width="1.5"/>
      <line x1="25" y1="8" x2="25" y2="2" stroke="#f9a825" stroke-width="1.5"/>
    </svg>`,
  },
  {
    id: 'transformer',
    name: 'Transformer',
    category: 'Energy',
    width: 60, height: 50,
    svg: `<svg viewBox="0 0 60 50" xmlns="http://www.w3.org/2000/svg">
      <circle cx="22" cy="25" r="13" fill="none" stroke="#333" stroke-width="2"/>
      <circle cx="38" cy="25" r="13" fill="none" stroke="#333" stroke-width="2"/>
      <line x1="0" y1="25" x2="9" y2="25" stroke="#333" stroke-width="2"/>
      <line x1="51" y1="25" x2="60" y2="25" stroke="#333" stroke-width="2"/>
    </svg>`,
  },

  // === Piping ===
  {
    id: 'pipe-straight',
    name: 'Pipe Horizontal',
    category: 'Piping',
    width: 100, height: 20,
    svg: `<svg viewBox="0 0 100 20" xmlns="http://www.w3.org/2000/svg">
      <line x1="0" y1="10" x2="100" y2="10" stroke="#333" stroke-width="4"/>
    </svg>`,
  },
  {
    id: 'pipe-elbow',
    name: 'Pipe Elbow',
    category: 'Piping',
    width: 40, height: 40,
    svg: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      <path d="M 0 10 L 10 10 Q 30 10 30 30 L 30 40" fill="none" stroke="#333" stroke-width="4" stroke-linecap="round"/>
    </svg>`,
  },
  {
    id: 'pipe-tee',
    name: 'Pipe Tee',
    category: 'Piping',
    width: 60, height: 40,
    svg: `<svg viewBox="0 0 60 40" xmlns="http://www.w3.org/2000/svg">
      <line x1="0" y1="10" x2="60" y2="10" stroke="#333" stroke-width="4"/>
      <line x1="30" y1="10" x2="30" y2="40" stroke="#333" stroke-width="4"/>
    </svg>`,
  },

  // === Heat Exchange ===
  {
    id: 'heat-exchanger',
    name: 'Heat Exchanger',
    category: 'Tanks',
    width: 70, height: 60,
    svg: `<svg viewBox="0 0 70 60" xmlns="http://www.w3.org/2000/svg">
      <circle cx="35" cy="30" r="25" fill="none" stroke="#333" stroke-width="2"/>
      <line x1="0" y1="30" x2="10" y2="30" stroke="#333" stroke-width="3"/>
      <line x1="60" y1="30" x2="70" y2="30" stroke="#333" stroke-width="3"/>
      <line x1="35" y1="5" x2="35" y2="0" stroke="#333" stroke-width="3"/>
      <line x1="35" y1="55" x2="35" y2="60" stroke="#333" stroke-width="3"/>
      <line x1="15" y1="20" x2="55" y2="20" stroke="#333" stroke-width="1.5"/>
      <line x1="15" y1="30" x2="55" y2="30" stroke="#333" stroke-width="1.5"/>
      <line x1="15" y1="40" x2="55" y2="40" stroke="#333" stroke-width="1.5"/>
    </svg>`,
  },
  {
    id: 'heater',
    name: 'Heater',
    category: 'Drives',
    width: 50, height: 50,
    svg: `<svg viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg">
      <rect x="5" y="5" width="40" height="40" fill="none" stroke="#333" stroke-width="2" rx="3"/>
      <polyline points="12,35 16,15 22,35 28,15 34,35 38,15" fill="none" stroke="#e53935" stroke-width="2"/>
    </svg>`,
  },
]

export const scadaCategories = [...new Set(scadaSymbols.map(s => s.category))]
