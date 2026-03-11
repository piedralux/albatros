import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import ReactMarkdown from 'react-markdown';
import { MapPin, Calendar, Activity, Car, Target, Waves, Wind, Navigation, Loader2, ChevronDown, ChevronUp, BarChart2, Share2, Check, Copy, Thermometer, Droplets, Cloud, CloudRain, Droplet, ArrowRight, Sun, Moon, AlertCircle, ArrowDown, Shirt, Star, Search, Cpu } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

// Fix Leaflet's default icon path issues with bundlers
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

const SPOT_COORDINATES: Record<string, { lat: number, lng: number }> = {
  // --- MAR DEL PLATA ---
  // Norte
  "Sun Rider": { lat: -37.9560, lng: -57.5465 },
  "Estrada": { lat: -37.9660, lng: -57.5435 },
  "Cardiel": { lat: -37.9790, lng: -57.5405 },
  
  // La Perla
  "Alfonsina": { lat: -37.9910, lng: -57.5465 },
  "Saint Michel": { lat: -37.9930, lng: -57.5455 },
  "San Sebastián": { lat: -37.9950, lng: -57.5445 },
  "Alicante": { lat: -37.9970, lng: -57.5435 },
  
  // Centro
  "Playa Popular": { lat: -38.0030, lng: -57.5415 },
  "Punta Iglesia": { lat: -38.0010, lng: -57.5425 },
  "Cabo Corrientes": { lat: -38.0160, lng: -57.5290 },
  "Varese": { lat: -38.0130, lng: -57.5315 },
  
  // Playa Grande
  "Playa Grande (Biología)": { lat: -38.0260, lng: -57.5305 },
  "Playa Grande (El Yacht)": { lat: -38.0310, lng: -57.5320 },
  "Playa Grande (Escollera)": { lat: -38.0330, lng: -57.5330 },
  
  // Punta Mogotes (Complejo)
  "Punta Mogotes (Balneario 1)": { lat: -38.0480, lng: -57.5410 },
  "Punta Mogotes (Balneario 12)": { lat: -38.0600, lng: -57.5430 },
  "Punta Mogotes (Balneario 24)": { lat: -38.0720, lng: -57.5450 },
  
  // Sur (The "Point")
  "Waikiki": { lat: -38.0831, lng: -57.5442 },
  "Mariano": { lat: -38.0850, lng: -57.5460 },
  "Honu Beach": { lat: -38.0880, lng: -57.5480 },
  "El Faro": { lat: -38.0910, lng: -57.5500 },
  "La Serena": { lat: -38.0950, lng: -57.5520 },
  "Acantilados": { lat: -38.1050, lng: -57.5550 },
  "Luna Roja": { lat: -38.1601, lng: -57.6391 },
  "Cruz del Sur": { lat: -38.1665, lng: -57.6470 },
  "RCT": { lat: -38.1765, lng: -57.6570 },
  "Siempre Verde": { lat: -38.1850, lng: -57.6650 },
  
  // --- MIRAMAR ---
  "Miramar (El Muelle)": { lat: -38.2760, lng: -57.8265 },
  "Miramar (Punta Viracho)": { lat: -38.2860, lng: -57.8165 },
  "Miramar (Pompeya)": { lat: -38.2660, lng: -57.8325 },
  "Miramar (El Chiringuito)": { lat: -38.2950, lng: -57.8050 },

  // --- NECOCHEA & QUEQUÉN ---
  "Quequén (Monte Pasubio)": { lat: -38.5715, lng: -58.6745 },
  "Quequén (La Hélice)": { lat: -38.5775, lng: -58.6845 },
  "Quequén (Escollera)": { lat: -38.5750, lng: -58.6900 },
  "Necochea (Escollera)": { lat: -38.5875, lng: -58.7065 },
  "Necochea (El Caño)": { lat: -38.5935, lng: -58.7145 },
  "Necochea (Karamawi)": { lat: -38.6015, lng: -58.7245 },

  // Costa Atlántica Norte
  "San Clemente (El Muelle)": { lat: -36.3560, lng: -56.6865 },
  "Santa Teresita": { lat: -36.5410, lng: -56.6865 },
  "San Bernardo": { lat: -36.6860, lng: -56.6765 },
  "Mar de Ajó": { lat: -36.7260, lng: -56.6765 },
  "Pinamar (El Muelle)": { lat: -37.1160, lng: -56.8565 },
  "UFO Point": { lat: -37.1060, lng: -56.8465 },
  "Cariló": { lat: -37.1660, lng: -56.8965 },
  "Villa Gesell": { lat: -37.2560, lng: -56.9665 },
  "Mar de las Pampas": { lat: -37.3260, lng: -57.0265 },
  "Mar Chiquita": { lat: -37.7560, lng: -57.4265 },

  // Patagonia
  "Las Grutas": { lat: -40.8160, lng: -65.0965 },
  "Playa Unión": { lat: -43.3260, lng: -65.0365 },
  "Rio Grande": { lat: -53.7860, lng: -67.7000 }
};

const sanitizeResult = (data: any) => {
  if (!data || !data.dailyResults) return data;
  
  data.dailyResults.forEach((day: any) => {
    if (day.bestSpots) {
      day.bestSpots.forEach((window: any) => {
        if (window.spots) {
          window.spots.forEach((spot: any) => {
            // Normalización agresiva para matching inequívoco
            const normalize = (s: string) => s.toLowerCase().trim()
              .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Quita acentos
              .replace(/^(playa|balneario|parador|point|spot)\s+/i, "") // Quita prefijos comunes
              .replace(/[^a-z0-9]/g, ""); // Quita todo lo que no sea letra o número
            
            const normalizedSpotName = normalize(spot.name);
            
            let matchedName = null;
            
            // Alias manuales para spots renombrados o conocidos por varios nombres
            const aliases: Record<string, string> = {
              "lapaloma": "Acantilados",
              "paloma": "Acantilados",
              "biologia": "Playa Grande (Biología)",
              "yacht": "Playa Grande (El Yacht)",
              "elyacht": "Playa Grande (El Yacht)",
              "popular": "Playa Popular",
              "varese": "Varese",
              "waikiki": "Waikiki",
              "serena": "Serena Sur",
              "lunaroja": "Luna Roja",
              "cruzdelsur": "Cruz del Sur",
              "rct": "RCT"
            };

            if (aliases[normalizedSpotName]) {
              matchedName = aliases[normalizedSpotName];
            } else {
              for (const dbName of Object.keys(SPOT_COORDINATES)) {
                const dbNormalized = normalize(dbName);
                
                if (normalizedSpotName === dbNormalized || 
                    normalizedSpotName.includes(dbNormalized) || 
                    dbNormalized.includes(normalizedSpotName)) {
                  matchedName = dbName;
                  break;
                }
              }
            }
            
            if (matchedName) {
              spot.name = matchedName;
              spot.lat = SPOT_COORDINATES[matchedName].lat;
              spot.lng = SPOT_COORDINATES[matchedName].lng;
            } else {
              // Si no hay match, forzamos a una posición segura si las coordenadas de la IA son sospechosas
              // O simplemente dejamos que la IA intente, pero el sistema de arriba cubre el 99% de los casos reales.
              console.warn(`No se encontró match para el spot: ${spot.name}`);
            }
          });
        }
      });
    }
  });
  return data;
};

const MOCK_RESULT = {
  greeting: "¡Aloha, rider! Te compartimos un análisis de demostración para tu sesión.",
  astronomy: { sunrise: "06:15", sunset: "19:30" },
  dailyResults: [
    {
      date: "2026-03-03",
      dayName: "Martes 3",
      forecast: [
        { time: "Mañana (08:00)", windSpeed: 11, windDirection: "NW", waveHeight: 1.2, waveDirection: "S", wavePeriod: 10, cloudCover: 10, weather: "Soleado", airTemp: 22, waterTemp: 20, wetsuit: "3/2mm" },
        { time: "Tarde (17:00)", windSpeed: 15, windDirection: "E", waveHeight: 0.9, waveDirection: "E", wavePeriod: 7, cloudCover: 60, weather: "Nublado", airTemp: 26, waterTemp: 21, wetsuit: "3/2mm" }
      ],
      bestSpots: [
        {
          timeWindow: "Mañana",
          spots: [
            { name: "Playa Grande (El Yacht)", score: 8, description: "Buenas condiciones con viento offshore suave.", lat: -38.0312, lng: -57.5332 }
          ]
        },
        {
          timeWindow: "Tarde",
          spots: [
            { name: "Varese", score: 6, description: "Protegido del viento que empieza a rotar.", lat: -38.0142, lng: -57.5345 }
          ]
        }
      ],
      verdict: "El point del día para esta jornada es **Playa Grande (Biología)**. El viento rotará al NE y se pondrá feo por la tarde, así que metete temprano. El swell del S con 10s garantiza rampas divertidas."
    }
  ]
};

const SYSTEM_INSTRUCTION = `Rol: Sos Surfpoint, un asesor experto en deportes de tabla marítimos (Surf, Bodyboard, Windsurf, Kitesurf, SUP, Wingfoil). Tu rango de acción es EXCLUSIVAMENTE la costa atlántica de la provincia de Buenos Aires y Río Negro, Argentina.

Reglas de Análisis (El Protocolo Surfpoint):
- Grounding (CRÍTICO): Usa \`googleSearch\` para consultar Windguru, Surf-forecast y Surfline.
  - Busca: "Windguru [Ciudad] hoy", "Surf-forecast [Ciudad]".
  - Analiza Swell (Dir/Período) y Viento (Dir/Nudos).
  - DEBES comparar 2 fuentes. Si hay discrepancia, prioriza Windguru.
- Brevedad (EXTREMA): Máximo 10 palabras por spot. Sin relleno.
- Coordenadas (REGLA DE ORO): LOS PINES DEBEN ESTAR EN LA ARENA.
  SOLO RECOMIENDA SPOTS QUE ESTÉN EN LA LISTA OBLIGATORIA. SI UN SPOT NO ESTÁ EN LA LISTA, NO LO INCLUYAS.
  USA ESTA LISTA OBLIGATORIA:
  - Mar del Plata:
    - Sun Rider: -37.9560, -57.5465
    - Estrada: -37.9660, -57.5435
    - Cardiel: -37.9790, -57.5405
    - Alfonsina: -37.9910, -57.5465
    - Saint Michel: -37.9930, -57.5455
    - Playa Popular: -38.0030, -57.5415
    - Punta Iglesia: -38.0010, -57.5425
    - Cabo Corrientes: -38.0160, -57.5290
    - Varese: -38.0130, -57.5315
    - Playa Grande (Biología): -38.0260, -57.5305
    - Playa Grande (El Yacht): -38.0310, -57.5320
    - Punta Mogotes (Balneario 12): -38.0600, -57.5430
    - Waikiki: -38.0831, -57.5442
    - Mariano: -38.0850, -57.5460
    - Honu Beach: -38.0880, -57.5480
    - El Faro: -38.0910, -57.5500
    - La Serena: -38.0950, -57.5520
    - Acantilados: -38.1050, -57.5550
    - Luna Roja: -38.1601, -57.6391
    - Cruz del Sur: -38.1665, -57.6470
    - RCT: -38.1765, -57.6570
  - Miramar:
    - Miramar (El Muelle): -38.2760, -57.8265
    - Miramar (Punta Viracho): -38.2860, -57.8165
    - Miramar (Pompeya): -38.2660, -57.8325
  - Necochea & Quequén:
    - Quequén (Monte Pasubio): -38.5715, -58.6745
    - Quequén (La Hélice): -38.5775, -58.6845
    - Necochea (Escollera): -38.5875, -58.7065
    - Necochea (El Caño): -38.5935, -58.7145
    - Necochea (Karamawi): -38.6015, -58.7245
  - Costa Atlántica Norte:
    - San Clemente (El Muelle): -36.3560, -56.6865
    - Santa Teresita: -36.5410, -56.6865
    - San Bernardo: -36.6860, -56.6765
    - Mar de Ajó: -36.7260, -56.6765
    - Pinamar (El Muelle): -37.1160, -56.8565
    - UFO Point: -37.1060, -56.8465
    - Cariló: -37.1660, -56.8965
    - Villa Gesell: -37.2560, -56.9665
    - Mar de las Pampas: -37.3260, -57.0265
    - Mar Chiquita: -37.7560, -57.4265
  - Patagonia:
    - Las Grutas: -40.8160, -65.0965
    - Playa Unión: -43.3260, -65.0365
    - Rio Grande: -53.7860, -67.7000
- Criterio de Puntuación: Sé MUY exigente (1-10).
- Diversidad: No te quedes solo en Playa Grande. Recomienda Serena Sur con viento N/NW, Varese con viento S fuerte, etc.
- Horario Lógico (CRÍTICO): El análisis DEBE dividirse exactamente en 2 franjas horarias:
  1. Mañana (Ref: 08:00)
  2. Tarde (Ref: 17:00)
- Filtro de Tiempo (ESTRICTO): Si la consulta se realiza después del mediodía (12:00), NO ENTREGUES información de la "Mañana". Solo entrega la "Tarde". Esto aplica tanto para el "forecast" como para los "bestSpots".
- Clima (Simplificado): Usa EXCLUSIVAMENTE "Soleado", "Nublado", "Lluvia" o "Tormenta". No uses "Parcialmente nublado" ni términos largos.
- "forecast": Array de 2 objetos. Cada uno DEBE incluir:
  - "time": "Mañana (08:00)" o "Tarde (17:00)"
  - "weather": "Soleado", "Nublado", "Lluvia" o "Tormenta"
  - "airTemp": número
  - "waterTemp": número
  - "wetsuit": string
  - "windSpeed": número (en nudos)
  - "windDirection": string (ej: "S", "NW")
  - "waveHeight": número (en metros)
  - "waveDirection": string (ej: "SE", "E")
  - "wavePeriod": número (en segundos)
  - "cloudCover": número (0-100)
- "bestSpots": Array de 2 objetos: "Mañana" y "Tarde". Cada uno tiene:
  - "timeWindow": "Mañana" o "Tarde"
  - "spots": Array de objetos con "name", "description", "score" (1-10), "lat", "lng".
- Veredicto: Corto y al pie. Nombra el spot ganador en negrita.
- Tono: Técnico y directo.

El output para el usuario debe ser un objeto JSON que contenga:
1. "greeting": Un saludo inicial. DEBE empezar con "¡Aloha, [apodo del deporte]!" (ej: rider, surfer, kiter) seguido de "Te compartimos el análisis para tu sesión de [Deporte] en [Ubicación]."
2. "astronomy": Un objeto con "sunrise" (ej: "06:30") y "sunset" (ej: "19:45").
3. "dailyResults": Un array de objetos, UNO POR CADA DÍA del rango solicitado. Cada objeto tiene:
   - "date": Fecha (ej: "2026-03-05")
   - "dayName": Nombre del día (ej: "Jueves 5")
   - "waterTemp": Temperatura del agua estimada (ej: 19)
   - "wetsuit": Recomendación de traje (ej: "3/2mm")
   - "weather": Estado del clima (ej: "Soleado", "Nublado", "Lluvia", "Tormenta")
   - "airTemp": Temperatura del aire estimada (ej: 22)
   - "forecast": Array con el pronóstico de ESE día (Mañana y Tarde).
   - "bestSpots": Array de spots recomendados para ESE día (Mañana y Tarde).
   - "verdict": Veredicto experto y decidido.`;

const TimePicker = ({ value, onChange, minTime, className = "" }: { value: string, onChange: (val: string) => void, minTime?: string, className?: string }) => {
  const [h, m] = value.split(':');
  
  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
  const minutes = ['00', '15', '30', '45'];

  const [minH, minM] = minTime ? minTime.split(':') : [null, null];

  return (
    <div className={`flex items-center gap-1 bg-white border-2 border-slate-100 rounded-2xl px-3 py-2 ${className}`}>
      <select 
        value={h} 
        onChange={(e) => onChange(`${e.target.value}:${m}`)}
        className="bg-transparent text-slate-800 text-sm font-bold focus:outline-none cursor-pointer appearance-none px-1"
      >
        {hours.map(hr => {
          const isDisabled = minH !== null && parseInt(hr) < parseInt(minH);
          return (
            <option key={hr} value={hr} disabled={isDisabled} className={isDisabled ? "text-slate-300" : "text-slate-800"}>
              {hr}
            </option>
          );
        })}
      </select>
      <span className="text-slate-300 font-black">:</span>
      <select 
        value={m} 
        onChange={(e) => onChange(`${h}:${e.target.value}`)}
        className="bg-transparent text-slate-800 text-sm font-bold focus:outline-none cursor-pointer appearance-none px-1"
      >
        {minutes.map(min => {
          const isDisabled = minH !== null && minM !== null && h === minH && parseInt(min) < parseInt(minM);
          return (
            <option key={min} value={min} disabled={isDisabled} className={isDisabled ? "text-slate-300" : "text-slate-800"}>
              {min}
            </option>
          );
        })}
      </select>
    </div>
  );
};

const DetailedUsageStats = ({ stats }: { stats: { prompt: number, candidates: number, total: number } | null }) => {
  if (!stats) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="max-w-4xl mx-auto px-4 mt-16 mb-8"
    >
      <div className="bg-slate-900 rounded-[2.5rem] p-8 md:p-12 shadow-2xl border border-slate-800 relative overflow-hidden group">
        {/* Background decorative elements */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-orange-600/10 blur-[120px] rounded-full -mr-48 -mt-48 animate-pulse" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-cyan-600/10 blur-[120px] rounded-full -ml-48 -mb-48 animate-pulse" style={{ animationDelay: '1s' }} />
        
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-10">
          <div className="space-y-4 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-3 mb-2">
              <div className="p-2 bg-orange-500/10 rounded-xl border border-orange-500/20">
                <Cpu size={24} className="text-orange-500" />
              </div>
              <span className="text-xs font-black uppercase tracking-[0.4em] text-orange-500">Métricas de Procesamiento</span>
            </div>
            <h3 className="text-3xl font-display font-extrabold italic tracking-tight text-white leading-tight">Consumo de la consulta</h3>
            <p className="text-slate-400 text-base font-medium max-w-sm leading-relaxed">
              Análisis realizado por Gemini 3.1 Pro. Estos son los recursos utilizados para generar tu reporte personalizado en tiempo real.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full md:w-auto">
            <div className="bg-slate-800/40 backdrop-blur-md p-6 rounded-3xl border border-slate-700/50 flex flex-col items-center justify-center text-center hover:border-orange-500/30 transition-all hover:bg-slate-800/60 group/card">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 group-hover/card:text-slate-400 transition-colors">Entrada</span>
              <span className="text-2xl font-mono font-bold text-white tracking-tighter">{stats.prompt.toLocaleString()}</span>
              <span className="text-[10px] font-bold text-slate-600 mt-1 uppercase tracking-widest">tokens</span>
            </div>
            <div className="bg-slate-800/40 backdrop-blur-md p-6 rounded-3xl border border-slate-700/50 flex flex-col items-center justify-center text-center hover:border-orange-500/30 transition-all hover:bg-slate-800/60 group/card">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 group-hover/card:text-slate-400 transition-colors">Salida</span>
              <span className="text-2xl font-mono font-bold text-white tracking-tighter">{stats.candidates.toLocaleString()}</span>
              <span className="text-[10px] font-bold text-slate-600 mt-1 uppercase tracking-widest">tokens</span>
            </div>
            <div className="bg-orange-600 p-6 rounded-3xl shadow-xl shadow-orange-900/20 flex flex-col items-center justify-center text-center transform hover:scale-[1.05] transition-all hover:shadow-orange-600/20">
              <span className="text-[10px] font-black uppercase tracking-widest text-orange-200 mb-2">Total</span>
              <span className="text-2xl font-mono font-bold text-white tracking-tighter">{stats.total.toLocaleString()}</span>
              <span className="text-[10px] font-bold text-orange-200 mt-1 uppercase tracking-widest">tokens</span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const CostEstimator = ({ stats, hasCustomKey }: { stats: { prompt: number, candidates: number, total: number } | null, hasCustomKey: boolean }) => {
  if (!stats) return null;

  return (
    <div className="flex items-center gap-3 px-3 py-1.5 bg-slate-100 rounded-full border border-slate-200 shadow-sm">
      <div className="flex items-center gap-1.5">
        <BarChart2 size={12} className="text-orange-600" />
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider hidden md:inline">Consumo:</span>
        <span className="text-[11px] font-mono font-bold text-slate-900">{stats.total.toLocaleString()} tokens</span>
      </div>
      <div className="h-3 w-[1px] bg-slate-300" />
      <div className="flex items-center gap-1">
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider hidden md:inline">Modo:</span>
        <span className={`text-[10px] font-black uppercase px-1.5 py-0.5 rounded ${hasCustomKey ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
          {hasCustomKey ? 'PRO' : 'FREE'}
        </span>
      </div>
    </div>
  );
};

const AdSlot = ({ className = '' }: { className?: string }) => (
  <div className={`bg-slate-100 border border-slate-200 border-dashed flex flex-col items-center justify-center text-slate-400 text-[10px] p-4 rounded-2xl ${className}`}>
    <span className="font-bold uppercase tracking-widest mb-1">Espacio Publicitario</span>
    <span className="opacity-50">Publicidad relevante para riders</span>
  </div>
);

const RadarLoader = ({ sport = 'Surf' }: { sport?: string }) => {
  const [messageIndex, setMessageIndex] = useState(0);
  
  const messages = {
    'Surf': [
      'Analizando el swell...',
      'Buscando la serie perfecta...',
      'Chequeando el período de las olas...',
      'Viendo dónde rompe mejor...',
      'Consultando satélites de clima...',
      'Buscando datos de condiciones...'
    ],
    'Bodyboard': [
      'Buscando rampas...',
      'Analizando el rebote en las escolleras...',
      'Chequeando la fuerza del labio...',
      'Escaneando tubos...',
      'Consultando satélites de clima...',
      'Buscando datos de condiciones...'
    ],
    'Windsurf': [
      'Midiendo rachas...',
      'Buscando viento constante...',
      'Analizando el planeo...',
      'Chequeando la dirección del viento...',
      'Buscando datos de condiciones...'
    ],
    'Kitesurf': [
      'Escaneando la ventana de viento...',
      'Buscando el mejor lanzamiento...',
      'Analizando la densidad del aire...',
      'Chequeando condiciones para saltar...',
      'Buscando datos de condiciones...'
    ],
    'SUP': [
      'Buscando aguas tranquilas...',
      'Analizando la deriva...',
      'Chequeando el viento de costa...',
      'Escaneando el horizonte...',
      'Buscando datos de condiciones...'
    ],
    'Wingfoil': [
      'Analizando el despegue...',
      'Buscando el mejor foil track...',
      'Midiendo la presión del viento...',
      'Chequeando el choppy...',
      'Buscando datos de condiciones...'
    ]
  };

  const currentMessages = messages[sport as keyof typeof messages] || messages['Surf'];

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % currentMessages.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [currentMessages.length]);

  return (
    <div className="flex flex-col items-center justify-center space-y-10">
      <div className="relative w-40 h-40 rounded-full border border-slate-200 bg-slate-50 overflow-hidden shadow-xl flex items-center justify-center">
        {/* Radar grid lines */}
        <div className="absolute inset-0 border border-slate-200 rounded-full m-6"></div>
        <div className="absolute inset-0 border border-slate-200 rounded-full m-14"></div>
        <div className="absolute w-full h-[1px] bg-slate-200"></div>
        <div className="absolute h-full w-[1px] bg-slate-200"></div>
        
        {/* Sweeping radar beam */}
        <motion.div 
          className="absolute inset-0 rounded-full"
          style={{
            background: 'conic-gradient(from 0deg, transparent 70%, rgba(234, 88, 12, 0.05) 80%, rgba(234, 88, 12, 0.3) 100%)'
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
        />
        
        {/* Blips */}
        <motion.div 
          className="absolute w-2 h-2 bg-orange-500 rounded-full shadow-[0_0_10px_rgba(234,88,12,0.5)]"
          style={{ top: '30%', left: '60%' }}
          animate={{ opacity: [0, 1, 0], scale: [0.5, 1.5, 0.5] }}
          transition={{ duration: 3, repeat: Infinity, times: [0, 0.1, 1] }}
        />
        <motion.div 
          className="absolute w-1.5 h-1.5 bg-orange-400 rounded-full shadow-[0_0_10px_rgba(234,88,12,0.3)]"
          style={{ top: '65%', left: '35%' }}
          animate={{ opacity: [0, 1, 0], scale: [0.5, 1.5, 0.5] }}
          transition={{ duration: 3, repeat: Infinity, delay: 1, times: [0, 0.1, 1] }}
        />
        
        <Waves className="relative z-10 text-orange-600 w-10 h-10 opacity-80" />
      </div>
      <div className="flex flex-col items-center gap-2">
        <h3 className="text-2xl font-display font-black italic uppercase tracking-tight text-slate-900 min-h-[1.75rem]">
          <AnimatePresence mode="wait">
            <motion.span
              key={messageIndex}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.3 }}
            >
              {currentMessages[messageIndex]}
            </motion.span>
          </AnimatePresence>
        </h3>
        <p className="text-xs font-extrabold text-slate-400 uppercase tracking-widest animate-pulse">Cruzando datos de viento, mareas y geografía</p>
      </div>
    </div>
  );
};

const getWindColor = (speed: number) => {
  if (speed < 8) return 'bg-blue-500/20 text-blue-300';
  if (speed < 15) return 'bg-emerald-500/30 text-emerald-300';
  if (speed < 20) return 'bg-yellow-500/30 text-yellow-300';
  return 'bg-red-500/30 text-red-300';
};

const getWaveColor = (height: number) => {
  if (height < 0.5) return 'bg-slate-700/50 text-slate-300';
  if (height < 1.0) return 'bg-cyan-900/50 text-cyan-300';
  if (height < 1.5) return 'bg-cyan-700/50 text-cyan-200';
  if (height < 2.0) return 'bg-blue-600/50 text-blue-200';
  return 'bg-indigo-600/50 text-indigo-200';
};

const getPeriodColor = (period: number) => {
  if (period < 7) return 'bg-slate-700/50 text-slate-300';
  if (period < 10) return 'bg-blue-900/50 text-blue-300';
  if (period < 13) return 'bg-indigo-900/50 text-indigo-300';
  return 'bg-purple-900/50 text-purple-300';
};

const getCloudColor = (cover: number) => {
  if (cover < 20) return { bg: 'bg-slate-50', text: 'text-slate-600' }; // Despejado
  if (cover < 40) return { bg: 'bg-slate-200', text: 'text-slate-700' }; // Algo nublado
  if (cover < 60) return { bg: 'bg-slate-400', text: 'text-slate-50' }; // Parcialmente nublado
  if (cover < 80) return { bg: 'bg-slate-600', text: 'text-slate-100' }; // Mayormente nublado
  return { bg: 'bg-slate-800', text: 'text-white' }; // Nublado
};

const BentoView = ({ verdict, mainStats }: { verdict: string, mainStats: any }) => {
  if (!mainStats) return null;

  return (
    <div className="space-y-6">
      {/* Main Verdict */}
      <div className="bg-white rounded-[2rem] shadow-lg border border-slate-100 relative overflow-hidden group transition-all">
        <div className="absolute top-0 right-0 w-64 h-64 bg-orange-50 rounded-full -mr-32 -mt-32 opacity-40 blur-3xl" />
        <div className="p-8 space-y-6 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-orange-600 rounded-xl flex items-center justify-center text-white shadow-md">
              <Target size={24} />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-600 block mb-0.5">EL VEREDICTO</span>
              <h2 className="text-2xl font-display font-extrabold italic tracking-tight text-slate-900 leading-none">La posta</h2>
            </div>
          </div>
          <div className="text-lg md:text-xl text-slate-800 font-medium leading-relaxed markdown-body">
            <ReactMarkdown>{verdict}</ReactMarkdown>
          </div>
        </div>
      </div>

      {/* Key Stats - Horizontal Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Waves Card */}
        <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-md flex flex-col items-center text-center group hover:border-cyan-200 transition-all">
          <div className="w-12 h-12 bg-cyan-50 rounded-xl flex items-center justify-center text-cyan-600 mb-3 group-hover:scale-110 transition-transform">
            <Waves size={24} />
          </div>
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">OLAS</span>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-display font-black text-slate-900">{mainStats.waveHeight}</span>
            <span className="text-sm font-bold text-slate-400">m</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 px-3 py-1 bg-slate-50 rounded-full text-xs font-black text-slate-600 border border-slate-100">
            <Navigation size={12} className="text-cyan-500" style={{ transform: `rotate(${getDirectionRotation(mainStats.waveDirection)}deg)` }} />
            {mainStats.waveDirection}
          </div>
        </div>

        {/* Wind Card */}
        <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-md flex flex-col items-center text-center group hover:border-orange-200 transition-all">
          <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center text-orange-600 mb-3 group-hover:scale-110 transition-transform">
            <Wind size={24} />
          </div>
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">VIENTO</span>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-display font-black text-slate-900">{mainStats.windSpeed}</span>
            <span className="text-sm font-bold text-slate-400">km/h</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 px-3 py-1 bg-slate-50 rounded-full text-xs font-black text-slate-600 border border-slate-100">
            <Navigation size={12} className="text-orange-500" style={{ transform: `rotate(${getDirectionRotation(mainStats.windDirection)}deg)` }} />
            {mainStats.windDirection}
          </div>
        </div>

        {/* Period Card */}
        <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-md flex flex-col items-center text-center group hover:border-blue-200 transition-all">
          <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 mb-3 group-hover:scale-110 transition-transform">
            <Activity size={24} />
          </div>
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">PERÍODO</span>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-display font-black text-slate-900">{mainStats.wavePeriod}</span>
            <span className="text-sm font-bold text-slate-400">s</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const InfoAgua = ({ forecast }: { forecast: any[] }) => {
  const getWeatherIcon = (condition: string = "") => {
    const c = condition.toLowerCase();
    if (c.includes('sol') || c.includes('despejado')) return <Sun size={20} className="text-yellow-500" />;
    if (c.includes('lluvia') || c.includes('tormenta')) return <CloudRain size={20} className="text-blue-400" />;
    if (c.includes('nublado')) return <Cloud size={20} className="text-slate-400" />;
    return <Sun size={20} className="text-yellow-500" />;
  };

  return (
    <div className="bg-slate-50/30 border-t border-slate-100 p-6">
      <div className={`grid gap-4 ${forecast.length > 1 ? 'md:grid-cols-2' : 'grid-cols-1'}`}>
        {forecast.map((p, idx) => (
          <div key={idx} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-slate-50 pb-3">
              <span className="text-[12px] font-black text-slate-400 uppercase tracking-widest">
                {idx === 0 && forecast.length > 1 ? 'MAÑANA' : (p.time?.includes('Tarde') ? 'TARDE' : 'MAÑANA')}
              </span>
              <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl">
                {getWeatherIcon(p.weather)}
                <span className="text-xs font-black text-slate-900 uppercase tracking-tight">{p.weather || 'Soleado'}</span>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col items-center gap-1.5 p-2 rounded-xl bg-orange-50/50">
                <Thermometer size={16} className="text-orange-500" />
                <div className="flex flex-col items-center">
                  <span className="text-[8px] font-black text-orange-400 uppercase tracking-widest leading-none mb-0.5">AIRE</span>
                  <span className="text-base font-black text-orange-600">{p.airTemp || 22}°C</span>
                </div>
              </div>

              <div className="flex flex-col items-center gap-1.5 p-2 rounded-xl bg-blue-50/50">
                <Droplet size={16} className="text-blue-500" />
                <div className="flex flex-col items-center">
                  <span className="text-[8px] font-black text-blue-400 uppercase tracking-widest leading-none mb-0.5">AGUA</span>
                  <span className="text-base font-black text-blue-700">{p.waterTemp}°C</span>
                </div>
              </div>

              <div className="flex flex-col items-center gap-1.5 p-2 rounded-xl bg-slate-50">
                <Shirt size={16} className="text-slate-500" />
                <div className="flex flex-col items-center">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5">TRAJE</span>
                  <span className="text-[11px] font-black text-slate-700 text-center leading-tight">{p.wetsuit}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const EstadoDeLasCosas = ({ forecast, astronomy }: { forecast: any[], astronomy: any }) => {
  const [isOpen, setIsOpen] = useState(false);
  if (!forecast || forecast.length === 0) return null;

  const periods = forecast;

  const getTimeRange = (timeLabel: string) => {
    if (timeLabel.includes('08:00')) return 'Mañana';
    if (timeLabel.includes('17:00')) return 'Tarde';
    return timeLabel;
  };

  return (
    <div className="bg-white rounded-[2rem] overflow-hidden border border-slate-100 shadow-lg">
      <div className="w-full p-6 md:p-8 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-3 hover:opacity-80 transition-opacity"
        >
          <Activity className="text-orange-600" size={24} />
          <h3 className="text-xl font-display font-extrabold italic tracking-tight text-slate-900">Pronóstico detallado</h3>
          {isOpen ? <ChevronUp className="text-slate-400" size={20} /> : <ChevronDown className="text-slate-400" size={20} />}
        </button>
        
        {astronomy && (
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="text-yellow-500">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
                  <path d="m8 12.2 3-3 3 3" />
                  <path d="M12 9.2V22" />
                </svg>
              </div>
              <span className="text-lg font-black text-slate-800">{astronomy.sunrise}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-blue-500">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
                  <path d="m8 15.8 3 3 3-3" />
                  <path d="M12 18.8V2" />
                </svg>
              </div>
              <span className="text-lg font-black text-slate-800">{astronomy.sunset}</span>
            </div>
          </div>
        )}
      </div>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-xs font-extrabold uppercase tracking-widest text-slate-500 border-b border-slate-200 bg-slate-100">
                    <th className="px-6 py-4">HORA</th>
                    {periods.map((p, i) => (
                      <th key={i} className="px-6 py-4 text-center">
                        <div className="text-sm text-slate-900 font-black uppercase">{p.time}</div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">{getTimeRange(p.time)}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-slate-100">
                  <tr>
                    <td className="px-6 py-2 text-sm font-extrabold text-slate-500 uppercase flex items-center gap-2">
                      <Wind size={16} className="text-orange-600" /> Viento
                    </td>
                    {periods.map((p, i) => (
                      <td key={i} className="px-6 py-2 text-center">
                        <div className={`inline-flex items-center justify-center gap-2 w-32 py-1.5 rounded-xl font-black text-base ${i === 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-yellow-50 text-yellow-700'}`}>
                          {p.windSpeed} <Navigation size={12} style={{ transform: `rotate(${getDirectionRotation(p.windDirection)}deg)` }} /> {p.windDirection}
                        </div>
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-6 py-2 text-sm font-extrabold text-slate-500 uppercase flex items-center gap-2">
                      <Waves size={16} className="text-orange-600" /> Olas
                    </td>
                    {periods.map((p, i) => (
                      <td key={i} className="px-6 py-2 text-center">
                        <div className="inline-flex items-center justify-center gap-2 w-32 py-1.5 rounded-xl font-black text-base bg-cyan-50 text-cyan-700">
                          {p.waveHeight} <Navigation size={12} style={{ transform: `rotate(${getDirectionRotation(p.waveDirection)}deg)` }} /> {p.waveDirection}
                        </div>
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-6 py-2 text-sm font-extrabold text-slate-500 uppercase flex items-center gap-2">
                      <Activity size={16} className="text-orange-600" /> Período
                    </td>
                    {periods.map((p, i) => (
                      <td key={i} className="px-6 py-2 text-center">
                        <div className="inline-flex items-center justify-center gap-2 w-32 py-1.5 rounded-xl font-black text-base bg-blue-50 text-blue-700">
                          {p.wavePeriod}s
                        </div>
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-6 py-2 text-sm font-extrabold text-slate-500 uppercase flex items-center gap-2">
                      <Cloud size={16} className="text-orange-600" /> Nubes
                    </td>
                    {periods.map((p, i) => {
                      const colors = getCloudColor(p.cloudCover);
                      return (
                        <td key={i} className="px-6 py-2 text-center">
                          <div className={`inline-flex items-center justify-center gap-2 w-32 py-1.5 rounded-xl font-black text-base ${colors.bg} ${colors.text}`}>
                            {p.cloudCover}%
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Helper to change map view
function ChangeView({ center, zoom }: { center: [number, number], zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom]);
  return null;
}

const MapView = ({ spots, activeSpot, onSpotClick }: { spots: any[], activeSpot: any, onSpotClick: (spot: any) => void }) => {
  const center: [number, number] = activeSpot ? [activeSpot.lat, activeSpot.lng] : (spots.length > 0 ? [spots[0].lat, spots[0].lng] : [-38.0055, -57.5400]);
  const zoom = activeSpot ? 16 : 13;
  
  return (
    <div className="h-[400px] lg:h-[600px] w-full rounded-[2rem] overflow-hidden border-4 border-white shadow-2xl relative z-0">
      <MapContainer center={center} zoom={zoom} style={{ height: '100%', width: '100%' }}>
        <ChangeView center={center} zoom={zoom} />
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution='&copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EBP, and the GIS User Community'
        />
        <TileLayer
          url="https://stamen-tiles-{s}.a.ssl.fastly.net/toner-labels/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="http://stamen.com">Stamen Design</a>, <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a> &mdash; Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          opacity={0.7}
        />
        {spots.map((spot, idx) => (
          <Marker 
            key={idx} 
            position={[spot.lat, spot.lng]}
            eventHandlers={{
              click: () => onSpotClick(spot),
            }}
          >
            <Popup>
              <div className="p-2 min-w-[150px]">
                <h4 className="font-black text-slate-900 text-sm uppercase mb-1">{spot.name}</h4>
                <p className="text-xs text-slate-600 mb-3 leading-tight">{spot.description}</p>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Star size={12} className="text-orange-500 fill-orange-500" />
                    <span className="text-xs font-black text-slate-900">{spot.score}/10</span>
                  </div>
                  <a 
                    href={`https://www.google.com/maps/search/?api=1&query=${spot.lat},${spot.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] font-black uppercase bg-orange-600 text-white px-3 py-1.5 rounded-lg text-center hover:bg-orange-700 transition-colors flex items-center justify-center gap-1"
                  >
                    <Navigation size={10} /> Cómo llegar
                  </a>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};

const getDirectionRotation = (dir: string) => {
  if (!dir) return 0;
  const map: Record<string, number> = {
    'N': 0, 'NNE': 22.5, 'NE': 45, 'ENE': 67.5,
    'E': 90, 'ESE': 112.5, 'SE': 135, 'SSE': 157.5,
    'S': 180, 'SSW': 202.5, 'SW': 225, 'WSW': 247.5,
    'W': 270, 'WNW': 292.5, 'NW': 315, 'NNW': 337.5
  };
  return map[dir.toUpperCase()] ?? 0;
};

const SPORT_IMAGES: Record<string, string[]> = {
  'Surf': [
    'https://res.cloudinary.com/dktrerrgh/image/upload/v1772578531/surf-2.jpg',
    'https://res.cloudinary.com/dktrerrgh/image/upload/v1772578530/surf-3.jpg',
    'https://res.cloudinary.com/dktrerrgh/image/upload/v1772578527/surf-5.jpg',
    'https://res.cloudinary.com/dktrerrgh/image/upload/v1772578527/surf-4.jpg',
    'https://res.cloudinary.com/dktrerrgh/image/upload/v1772578526/surf-7.jpg'
  ],
  'Bodyboard': [
    'https://res.cloudinary.com/dktrerrgh/image/upload/v1772578520/body-3.jpg',
    'https://res.cloudinary.com/dktrerrgh/image/upload/v1772578520/body-1.jpg',
    'https://res.cloudinary.com/dktrerrgh/image/upload/v1772578521/body-4.jpg',
    'https://res.cloudinary.com/dktrerrgh/image/upload/v1772578521/body-5.jpg',
    'https://res.cloudinary.com/dktrerrgh/image/upload/v1772578532/body-7.jpg',
    'https://res.cloudinary.com/dktrerrgh/image/upload/v1772578521/body-2.jpg'
  ],
  'Kitesurf': [
    'https://res.cloudinary.com/dktrerrgh/image/upload/v1772578531/kite-1.jpg',
    'https://res.cloudinary.com/dktrerrgh/image/upload/v1772578531/kite-3.jpg',
    'https://res.cloudinary.com/dktrerrgh/image/upload/v1772578531/kite-2.jpg',
    'https://res.cloudinary.com/dktrerrgh/image/upload/v1772578535/kite-4.jpg',
    'https://res.cloudinary.com/dktrerrgh/image/upload/v1772578535/kite-5.jpg'
  ],
  'Windsurf': [
    'https://res.cloudinary.com/dktrerrgh/image/upload/v1772578535/wind-5.jpg',
    'https://res.cloudinary.com/dktrerrgh/image/upload/v1772578536/wind-4.jpg',
    'https://res.cloudinary.com/dktrerrgh/image/upload/v1772578537/wind-3.jpg',
    'https://res.cloudinary.com/dktrerrgh/image/upload/v1772578539/wind-1.jpg',
    'https://res.cloudinary.com/dktrerrgh/image/upload/v1772578539/wind-2.jpg'
  ],
  'Wingfoil': [
    'https://res.cloudinary.com/dktrerrgh/image/upload/v1772578535/wind-5.jpg',
    'https://res.cloudinary.com/dktrerrgh/image/upload/v1772578536/wind-4.jpg',
    'https://res.cloudinary.com/dktrerrgh/image/upload/v1772578537/wind-3.jpg',
    'https://res.cloudinary.com/dktrerrgh/image/upload/v1772578539/wind-1.jpg',
    'https://res.cloudinary.com/dktrerrgh/image/upload/v1772578539/wind-2.jpg'
  ],
  'SUP': [
    'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&q=80&w=1000',
    'https://images.unsplash.com/photo-1517176642928-59272c582ba7?auto=format&fit=crop&q=80&w=1000'
  ]
};

const HERO_IMAGES = SPORT_IMAGES['Surf']; // Default fallback

export default function App() {
  const getTodayDate = () => {
    const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0];
  };

  const getTomorrowDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0];
  };

  const searchParams = new URLSearchParams(window.location.search);

  const [location, setLocation] = useState(searchParams.get('loc') || '');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [startDate, setStartDate] = useState(searchParams.get('sDate') || getTodayDate());
  const [endDate, setEndDate] = useState(searchParams.get('eDate') || getTodayDate());
  const [sport, setSport] = useState(searchParams.get('sport') || 'Surf');
  const [mobility, setMobility] = useState(Number(searchParams.get('mob')) || 15);
  const [objective, setObjective] = useState(searchParams.get('obj') || '');
  
  const suggestions = [
    'Mar del Plata',
    'Necochea',
    'Miramar',
    'Pinamar',
    'Villa Gesell',
    'Quequén',
    'Claromecó',
    'Monte Hermoso',
    'Mar Chiquita',
    'Santa Teresita'
  ].filter(s => s.toLowerCase().includes(location.toLowerCase()));

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState<string | React.ReactNode | null>(null);
  const [showCharts, setShowCharts] = useState(false);
  const [isFromCache, setIsFromCache] = useState(false);
  const [cacheTimestamp, setCacheTimestamp] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [progress, setProgress] = useState(0);
  const [hasAutoSubmitted, setHasAutoSubmitted] = useState(false);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [heroImage, setHeroImage] = useState(HERO_IMAGES[0]);
  const [shareOpenTop, setShareOpenTop] = useState(false);
  const [shareOpenBottom, setShareOpenBottom] = useState(false);
  const [hasCustomKey, setHasCustomKey] = useState(false);
  const [usageStats, setUsageStats] = useState<{ prompt: number, candidates: number, total: number } | null>(null);
  const [view, setView] = useState<'form' | 'results'>('form');
  const [activeSpot, setActiveSpot] = useState<any | null>(null);
  const mapRef = useRef<any>(null);

  // Check for custom API key on mount
  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio?.hasSelectedApiKey) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setHasCustomKey(hasKey);
      }
    };
    checkKey();
  }, []);

  const handleOpenKeySelector = async () => {
    if (window.aistudio?.openSelectKey) {
      try {
        await window.aistudio.openSelectKey();
        // Assume success and refresh state
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setHasCustomKey(hasKey);
        setError(null);
        // Trigger a new search automatically if they just linked a key
        if (hasKey) {
          handleSubmit();
        }
      } catch (err) {
        console.error("Error al abrir el selector de llaves:", err);
        alert("No se pudo abrir el selector de llaves. Por favor, intentá de nuevo o revisá la configuración de tu navegador.");
      }
    } else {
      alert("El selector de llaves no está disponible en este entorno. Si estás usando un bloqueador de anuncios o una ventana de incógnito, intentá desactivarlos.");
    }
  };

  const resultsRef = useRef<HTMLDivElement>(null);
  const shareRefTop = useRef<HTMLDivElement>(null);
  const shareRefBottom = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Audio refs
  const clickSound = useRef<HTMLAudioElement | null>(null);
  const successSound = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    clickSound.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3');
    successSound.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3');
    if (clickSound.current) clickSound.current.volume = 0.3;
    if (successSound.current) successSound.current.volume = 0.4;
  }, []);

  const playClick = () => clickSound.current?.play().catch(() => {});
  const playSuccess = () => successSound.current?.play().catch(() => {});

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (shareRefTop.current && !shareRefTop.current.contains(event.target as Node)) {
        setShareOpenTop(false);
      }
      if (shareRefBottom.current && !shareRefBottom.current.contains(event.target as Node)) {
        setShareOpenBottom(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const images = SPORT_IMAGES[sport] || HERO_IMAGES;
    setHeroImage(images[Math.floor(Math.random() * images.length)]);
  }, [sport]);

  useEffect(() => {
    if (result && !loading) {
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    }
  }, [result, loading, view]);

  useEffect(() => {
    if (result) {
      setSelectedDayIndex(0);
    }
  }, [result]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (loading) {
      setProgress(0);
      interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 99) return 99;
          // Much slower progress to avoid hitting 99% too fast
          // Aiming for ~90% at 90 seconds
          const remaining = 100 - prev;
          const increment = (Math.random() * remaining) / 40; 
          return Math.min(99, prev + increment);
        });
      }, 1000);
    } else {
      setProgress(100);
      const timeout = setTimeout(() => setProgress(0), 500);
      return () => clearTimeout(timeout);
    }
    return () => clearInterval(interval);
  }, [loading]);

  const getDayOfWeek = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString + 'T00:00:00');
    const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    return days[date.getDay()];
  };

  const getMaxEndDate = (startD: string) => {
    if (!startD) return undefined;
    const d = new Date(startD);
    d.setDate(d.getDate() + 3);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0];
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (loading) {
      // Cancel logic
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      setLoading(false);
      setProgress(0);
      return;
    }

    if (!location || !startDate || !endDate) {
      setError('Por favor, completá la ciudad y las fechas.');
      return;
    }

    playClick();

    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T23:59:59`);
    const now = new Date();

    if (new Date(`${startDate}T23:59:59`) < now) {
      setError('La fecha de inicio no puede ser anterior al día de hoy.');
      return;
    }

    const diffDays = (end.getTime() - start.getTime()) / (1000 * 3600 * 24);
    
    if (diffDays > 3) {
      setError('El rango de fechas no puede superar los 3 días debido a la alta variabilidad de las condiciones.');
      return;
    }
    if (diffDays < 0) {
      setError('La fecha de fin no puede ser anterior a la fecha de inicio.');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);
    setShowCharts(false);
    setHasAutoSubmitted(true);
    
    // Initialize abort controller
    abortControllerRef.current = new AbortController();

    const params = new URLSearchParams({
      loc: location,
      sDate: startDate,
      eDate: endDate,
      sport,
      mob: mobility.toString(),
      obj: objective
    });
    window.history.pushState({}, '', `?${params.toString()}`);

    // Cache key based on search parameters to save API quota
    const cacheKey = `laposta_${params.toString()}`;
    const cachedEntry = localStorage.getItem(cacheKey);
    const CACHE_TTL = 2 * 60 * 60 * 1000; // 2 hours in milliseconds

    if (cachedEntry) {
      try {
        const { data, timestamp } = JSON.parse(cachedEntry);
        const age = Date.now() - timestamp;
        
        if (age < CACHE_TTL) {
          console.log("Cargando desde caché para ahorrar cuota de API...");
          setResult(data);
          setView('results');
          setIsFromCache(true);
          setCacheTimestamp(timestamp);
          playSuccess();
          setLoading(false);
          return;
        } else {
          console.log("Caché expirada, solicitando nuevos datos...");
          localStorage.removeItem(cacheKey);
        }
      } catch (e) {
        localStorage.removeItem(cacheKey);
      }
    }

    setIsFromCache(false);
    setCacheTimestamp(null);

    // Safety timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      if (abortControllerRef.current) {
        console.warn("Búsqueda cancelada por exceso de tiempo (timeout)");
        abortControllerRef.current.abort();
        setError(
          <div className="flex flex-col gap-2">
            <p className="font-bold">⚠️ El radar está tardando más de lo habitual.</p>
            <p className="text-xs opacity-80">Buscamos datos en tiempo real y a veces la conexión con los satélites de clima demora. Por favor, intentá de nuevo o reducí el rango de días.</p>
            <button 
              onClick={() => handleSubmit()}
              className="mt-2 bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg font-bold text-xs transition-colors w-fit"
            >
              REINTENTAR AHORA
            </button>
          </div>
        );
        setLoading(false);
      }
    }, 120000); // 120 seconds safety timeout

    const prompt = `
📍 Ubicación: ${location}
📅 RANGO SOLICITADO:
- Inicio: ${start.toLocaleDateString('es-AR')}
- Fin: ${end.toLocaleDateString('es-AR')}
🕒 HORA ACTUAL (Referencia): ${now.toLocaleString('es-AR')}

Instrucción para el modelo: Analizá cada día del rango solicitado. 
REGLA DE ORO: El análisis debe cubrir la JORNADA COMPLETA, desde el amanecer hasta el atardecer.
Si hoy es ${now.toLocaleDateString('es-AR')} y la hora actual es después de las 14:00, NO devuelvas info de la "Mañana" para hoy.
El veredicto debe ser corto, al pie, y centrarse en si las condiciones se ponen buenas o feas.

🏄 Deporte: ${sport}
🚗 Movilidad: Hasta ${mobility}km
🎯 Objetivo: ${objective || 'No especificado'}
`;

    try {
      // Use custom API key if available, otherwise fallback to platform key
      const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
      
      if (!apiKey || apiKey === 'undefined') {
        setError('Falta configurar la clave GEMINI_API_KEY en Vercel. Entrá a la configuración de tu proyecto en Vercel > Settings > Environment Variables y agregala.');
        setLoading(false);
        return;
      }

      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          temperature: 0, // Deterministic output for consistent forecasts
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
          tools: [{ googleSearch: {} }],
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              greeting: { type: Type.STRING, description: "El saludo inicial." },
              astronomy: {
                type: Type.OBJECT,
                description: "Horarios de luz solar.",
                properties: {
                  sunrise: { type: Type.STRING, description: "Hora de amanecer (ej: 06:30)" },
                  sunset: { type: Type.STRING, description: "Hora de atardecer (ej: 19:45)" }
                },
                required: ["sunrise", "sunset"]
              },
              dailyResults: {
                type: Type.ARRAY,
                description: "Resultados agrupados por día. DEBE haber un objeto por cada día en el rango solicitado.",
                items: {
                  type: Type.OBJECT,
                  properties: {
                    date: { type: Type.STRING, description: "Fecha (ej: 2026-03-03)" },
                    dayName: { type: Type.STRING, description: "Nombre del día (ej: Martes 3)" },
                    forecast: {
                      type: Type.ARRAY,
                      description: "Pronóstico detallado por horas para este día. Debe incluir exactamente 2 franjas horarias: Mañana (08:00) y Tarde (17:00).",
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          time: { type: Type.STRING, description: "Hora de referencia. DEBE ser uno de: 'Mañana (08:00)', 'Tarde (17:00)'" },
                          windSpeed: { type: Type.NUMBER, description: "Velocidad del viento en nudos" },
                          windDirection: { type: Type.STRING, description: "Dirección del viento (ej: NW, S, SE)" },
                          waveHeight: { type: Type.NUMBER, description: "Altura de la ola en metros" },
                          waveDirection: { type: Type.STRING, description: "Dirección de la ola (ej: S, SE, E)" },
                          wavePeriod: { type: Type.NUMBER, description: "Período de la ola en segundos" },
                          cloudCover: { type: Type.NUMBER, description: "Porcentaje de nubosidad (0 a 100)" },
                          weather: { type: Type.STRING, description: "Estado del clima. DEBE ser uno de: 'Soleado', 'Nublado', 'Lluvia', 'Tormenta'" },
                          airTemp: { type: Type.NUMBER, description: "Temperatura del aire estimada en °C" },
                          waterTemp: { type: Type.NUMBER, description: "Temperatura del agua estimada en °C" },
                          wetsuit: { type: Type.STRING, description: "Recomendación de traje (ej: 3/2mm)" }
                        },
                        required: ["time", "windSpeed", "windDirection", "waveHeight", "waveDirection", "wavePeriod", "cloudCover", "weather", "airTemp", "waterTemp", "wetsuit"]
                      }
                    },
                    bestSpots: {
                      type: Type.ARRAY,
                      description: "Los mejores spots para este día agrupados por franja horaria.",
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          timeWindow: { type: Type.STRING, description: "Franja horaria. DEBE ser uno de: 'Mañana', 'Tarde'" },
                          spots: {
                            type: Type.ARRAY,
                            description: "Spots recomendados en este horario, ordenados por calidad.",
                            items: {
                              type: Type.OBJECT,
                              properties: {
                                name: { type: Type.STRING },
                                description: { type: Type.STRING, description: "Máximo 15 palabras." },
                                lat: { type: Type.NUMBER },
                                lng: { type: Type.NUMBER },
                                score: { type: Type.NUMBER, description: "Puntaje del 1 al 10." },
                              },
                              required: ["name", "description", "lat", "lng", "score"]
                            }
                          }
                        },
                        required: ["timeWindow", "spots"]
                      }
                    },
                    verdict: { type: Type.STRING, description: "Veredicto experto y decidido." }
                  },
                  required: ["date", "dayName", "forecast", "bestSpots", "verdict"]
                }
              }
            },
            required: ["greeting", "astronomy", "dailyResults"],
          },
        },
      });

      if (abortControllerRef.current?.signal.aborted) return;

      const jsonStr = response.text || '{}';
      const parsed = sanitizeResult(JSON.parse(jsonStr));
      
      // Capture usage statistics
      if (response.usageMetadata) {
        setUsageStats({
          prompt: response.usageMetadata.promptTokenCount || 0,
          candidates: response.usageMetadata.candidatesTokenCount || 0,
          total: response.usageMetadata.totalTokenCount || 0
        });
      }
      
      setResult(parsed);
      setView('results');
      playSuccess();
      
      // Save successful result to cache with timestamp
      localStorage.setItem(cacheKey, JSON.stringify({
        data: parsed,
        timestamp: Date.now()
      }));
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error(err);
      if (err.message?.includes('429') || err.message?.includes('RESOURCE_EXHAUSTED') || err.message?.includes('503') || err.message?.includes('UNAVAILABLE')) {
        console.warn("Rate limit or service unavailable hit. Using mock data.");
        setResult(MOCK_RESULT);
        playSuccess();
        
        if (!hasCustomKey) {
          setError(
            <div className="flex flex-col gap-3">
              <p className="font-bold">⚠️ El radar gratuito está saturado.</p>
              <p className="text-xs opacity-80">
                Para usar Surfpoint sin límites, necesitás vincular tu propia API Key. 
                <span className="block mt-1 text-cyan-400 font-medium">Importante: Google requiere que tu proyecto tenga la facturación activa (aunque el uso de Gemini suele entrar en el plan gratuito).</span>
              </p>
              <div className="flex flex-wrap gap-2">
                <button 
                  onClick={handleOpenKeySelector}
                  className="bg-cyan-500 hover:bg-cyan-400 text-slate-900 px-4 py-2 rounded-lg font-bold text-xs transition-colors"
                >
                  VINCULAR MI API KEY
                </button>
                <a 
                  href="https://ai.google.dev/gemini-api/docs/billing" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-lg font-bold text-xs transition-colors flex items-center gap-1"
                >
                  INFO FACTURACIÓN
                </a>
              </div>
              <p className="text-[10px] opacity-60 italic">Si ya vinculaste una llave y sigue fallando, asegurate de que el proyecto en Google Cloud tenga una tarjeta vinculada.</p>
            </div>
          );
        } else {
          setError('⚠️ El servicio de Google está experimentando una demora inusual. Te mostramos datos de respaldo mientras se normaliza.');
        }
      } else {
        setError(`Hubo un error al consultar a Surfpoint (${err.message || 'Error desconocido'}). Por favor, intentá de nuevo.`);
      }
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  // Auto-submit on load if URL has parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('loc') && !hasAutoSubmitted) {
      handleSubmit();
    }
  }, []); // Only run once on mount

  const handleShare = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Error copying to clipboard', err);
    }
  };

  return (
    <div className="min-h-screen font-sans selection:bg-orange-200 flex flex-col">
      {/* Global Top Banner & Header */}
      <div className="sticky top-0 z-[100] bg-white border-b border-slate-100 shadow-sm">
        <div className="max-w-4xl mx-auto">
          <AdSlot className="h-20 md:h-24 bg-slate-50 border-x border-slate-100" />
        </div>
        
        {view === 'results' && (
          <header className="px-6 py-4 flex items-center justify-between border-t border-slate-50 relative">
            <button 
              onClick={() => setView('form')}
              className="flex items-center gap-2 text-sm font-extrabold text-slate-500 hover:text-orange-600 transition-colors uppercase tracking-tight z-10"
            >
              <ArrowDown className="rotate-90" size={16} />
              <span className="hidden sm:inline">Nueva Consulta</span>
            </button>

            <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 cursor-pointer" onClick={() => setView('form')}>
              <span className="text-xl md:text-2xl font-display font-extrabold tracking-tighter text-slate-900 uppercase italic">SURF<span className="text-orange-600">POINT</span></span>
            </div>
            
            <div className="z-10">
              <CostEstimator stats={usageStats} hasCustomKey={hasCustomKey} />
            </div>
          </header>
        )}
      </div>

      <AnimatePresence mode="wait">
        {view === 'form' ? (
          <motion.div
            key="form-view"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -20 }}
            className="relative min-h-screen flex flex-col"
          >
            {/* Background Hero */}
            <div className="absolute inset-0 z-0 overflow-hidden">
              <img 
                src={heroImage} 
                alt="Surf background" 
                className="w-full h-full object-cover animate-kenburns opacity-100"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-slate-100" />
            </div>

            {/* Main Form Hero */}
            <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 pt-[56px] pb-12">
                  <div className="w-full max-w-4xl text-center mb-[56px]">
                    <h1 
                      className="text-[80px] leading-[80px] font-display font-bold text-slate-900 mb-4 tracking-tighter uppercase italic whitespace-nowrap inline-block drop-shadow-sm"
                    >
                      SURF<span className="text-orange-600">POINT</span>
                    </h1>
                    <div className="space-y-2">
                      <p className="text-[22px] leading-[24px] text-black font-bold max-w-2xl mx-auto">
                        Encontrá olas y vientos épicos en tiempo real.
                      </p>
                    </div>
                  </div>

              <div className="w-full max-w-3xl flex flex-col items-center">
                <motion.div 
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="w-full bg-white/90 backdrop-blur-xl rounded-[2.5rem] p-8 md:p-10 shadow-2xl border border-white/50"
                >
                  <div className="mb-8 text-left px-1">
                    <p className="text-slate-500 font-normal text-[23px] leading-tight tracking-tight">
                      Llená el formulario y te damos la posta de dónde meterte
                    </p>
                  </div>
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {/* CIUDAD */}
                    <div className="space-y-2 relative">
                      <label className="text-[14px] font-bold text-slate-400 ml-1">Ciudad (donde te vas a meter al mar)</label>
                      <div className="relative">
                        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-orange-500" size={20} />
                        <input
                          type="text"
                          placeholder="Ej: Mar del Plata, Necochea..."
                          value={location}
                          onChange={(e) => {
                            setLocation(e.target.value);
                            setShowSuggestions(true);
                          }}
                          onFocus={() => setShowSuggestions(true)}
                          className="w-full pl-12 pr-4 py-4 bg-white border-2 border-slate-100 rounded-2xl focus:outline-none focus:border-orange-500 transition-all text-[16px] font-normal text-slate-800 shadow-sm"
                          required
                        />
                        {showSuggestions && location && suggestions.length > 0 && (
                          <div className="absolute z-50 w-full mt-2 bg-white border border-slate-100 rounded-2xl shadow-xl overflow-hidden">
                            {suggestions.map((s, i) => (
                              <button
                                key={i}
                                type="button"
                                onClick={() => {
                                  setLocation(s);
                                  setShowSuggestions(false);
                                }}
                                className="w-full px-6 py-4 text-left hover:bg-slate-50 text-slate-700 font-bold border-b border-slate-50 last:border-0 transition-colors"
                              >
                                {s}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Fechas */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[14px] font-bold text-slate-400 ml-1">Desde</label>
                        <input
                          type="date"
                          value={startDate}
                          min={getTodayDate()}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="w-full px-4 py-3 bg-white border-2 border-slate-100 rounded-2xl focus:outline-none focus:border-orange-500 text-[16px] font-normal text-slate-800 [color-scheme:light]"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[14px] font-bold text-slate-400 ml-1">Hasta</label>
                        <input
                          type="date"
                          value={endDate}
                          min={startDate || getTodayDate()}
                          max={getMaxEndDate(startDate)}
                          onChange={(e) => setEndDate(e.target.value)}
                          className="w-full px-4 py-3 bg-white border-2 border-slate-100 rounded-2xl focus:outline-none focus:border-orange-500 text-[16px] font-normal text-slate-800 [color-scheme:light]"
                          required
                        />
                      </div>
                    </div>

                    {/* Deporte y Movilidad */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                      <div className="space-y-3">
                        <label className="text-[14px] font-bold text-slate-400 ml-1">Deporte</label>
                        <div className="grid grid-cols-3 gap-2 bg-slate-200/60 p-1.5 rounded-2xl">
                          {['Surf', 'Bodyboard', 'Kitesurf', 'Windsurf', 'SUP', 'Wingfoil'].map((s) => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => setSport(s)}
                              className={`py-3 rounded-xl text-[16px] font-normal transition-all border-2 ${
                                sport === s 
                                  ? 'bg-white text-orange-600 border-white shadow-md scale-[1.02]' 
                                  : 'bg-white/60 text-slate-500 border-transparent hover:bg-white/80 hover:border-slate-300 hover:text-slate-700'
                              }`}
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div className="flex flex-col mb-1">
                          <label className="text-[14px] font-bold text-slate-400 ml-1">Movilidad</label>
                          <p className="text-[14px] text-slate-500 font-normal ml-1 mt-1">¿Cuánto te moverías si no hay olas cerca?</p>
                        </div>
                        <div className="px-2 relative h-8 flex items-center mt-2">
                          {/* Tick marks for affordance - aligned with thumb positions */}
                          <div className="absolute left-[13px] right-[13px] inset-0 flex justify-between pointer-events-none z-20 items-center">
                            {[0, 15, 30, 45].map((val) => (
                              <div 
                                key={val} 
                                className={`w-2 h-2 rounded-full bg-slate-400/60 border border-white/20 transition-opacity duration-200 ${mobility === val ? 'opacity-0' : 'opacity-100'}`} 
                              />
                            ))}
                          </div>
                          
                          <input
                            type="range"
                            min="0"
                            max="45"
                            step="15"
                            value={mobility}
                            onChange={(e) => setMobility(Number(e.target.value))}
                            className="relative z-10 w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-orange-600"
                          />
                        </div>
                          
                        <div className="flex justify-between text-[16px] font-normal text-slate-400 mt-4 px-2">
                          {['0', '15', '30', '45'].map(val => (
                            <div key={val} className="w-4 flex justify-center">
                              <span className={`transition-all duration-300 whitespace-nowrap ${mobility === Number(val) ? 'text-orange-600 scale-110' : ''}`}>
                                {val}KM
                              </span>
                            </div>
                          ))}
                        </div>
                        </div>
                      </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-5 bg-orange-600 hover:bg-orange-700 text-white rounded-2xl text-xl font-display font-extrabold uppercase tracking-wide italic flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-orange-200 transition-all"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="animate-spin" size={24} />
                          Consultando...
                        </>
                      ) : (
                        <>
                          <Search size={24} />
                          Buscar el point
                        </>
                      )}
                    </button>
                  </form>
                </motion.div>
              </div>
            </main>

            {/* Footer */}
            <footer className="relative z-10 p-8 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">
              © 2026 SURFPOINT • Hecho con <span className="text-orange-500">♥</span> en la costa
            </footer>
          </motion.div>
        ) : (
          <motion.div
            key="results-view"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="min-h-screen bg-slate-50 pb-20"
          >
            {/* Results Content */}
            <div className="max-w-4xl mx-auto px-4 py-12 space-y-16" ref={resultsRef}>
              {/* Hero Greeting */}
              {result?.greeting && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center px-4 py-6"
                >
                  <span className="text-xs font-black uppercase tracking-[0.3em] text-orange-600 mb-4 block">EL REPORTE</span>
                  <h2 className="text-[28px] md:text-[42px] font-display font-extrabold italic tracking-tight text-slate-900 leading-[1.1]">
                    {result.greeting}
                  </h2>
                </motion.div>
              )}

              {/* Day Selection Tabs - More prominent */}
              {result?.dailyResults && result.dailyResults.length > 1 && (
                <div className="flex justify-center p-1 bg-slate-200/50 rounded-[2rem] max-w-fit mx-auto backdrop-blur-sm">
                  {result.dailyResults.map((day: any, idx: number) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedDayIndex(idx)}
                      className={`px-8 py-4 rounded-[1.75rem] text-sm font-black transition-all whitespace-nowrap uppercase tracking-widest ${selectedDayIndex === idx ? 'bg-white text-orange-600 shadow-xl' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      {day.dayName}
                    </button>
                  ))}
                </div>
              )}

              {/* Active Day Content */}
              <AnimatePresence mode="wait">
                {result?.dailyResults?.[selectedDayIndex] && (
                  <motion.div
                    key={selectedDayIndex}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-8"
                  >
                    {/* Bento Grid: Verdict + Key Stats */}
                    <BentoView 
                      verdict={result.dailyResults[selectedDayIndex].verdict}
                      mainStats={result.dailyResults[selectedDayIndex].forecast[0]} // Use first period as representative
                    />

                    {/* Info Agua (Integrated - Bleeding to edges) */}
                    <div className="bg-white rounded-[2.5rem] shadow-xl border-2 border-slate-100 overflow-hidden">
                      <div className="p-8 md:p-10 border-b border-slate-100">
                        <div className="flex items-center gap-3 text-slate-900">
                          <Activity size={24} className="text-orange-600" />
                          <h2 className="text-2xl font-display font-extrabold italic tracking-tight">Condiciones del agua</h2>
                        </div>
                      </div>
                      <InfoAgua 
                        forecast={result.dailyResults[selectedDayIndex].forecast.filter((p: any) => {
                          const now = new Date();
                          const isToday = result.dailyResults[selectedDayIndex].date === now.toISOString().split('T')[0];
                          if (!isToday) return true;
                          // Check if time contains 'Mañana'
                          if (now.getHours() >= 12 && (p.time || '').includes('Mañana')) return false;
                          return true;
                        })}
                      />
                    </div>

                    {/* Spots Grid */}
                    <div className="bg-white rounded-[2rem] p-6 shadow-lg border border-slate-100 space-y-8">
                      <div className="flex items-center gap-3 text-slate-900 border-b border-slate-50 pb-4">
                        <MapPin size={24} className="text-orange-600" />
                        <h2 className="text-xl font-display font-extrabold italic tracking-tight">Los points del día</h2>
                      </div>
                      
                      <div className="space-y-8">
                        {result.dailyResults[selectedDayIndex].bestSpots
                          .filter((period: any) => {
                            const now = new Date();
                            const isToday = result.dailyResults[selectedDayIndex].date === now.toISOString().split('T')[0];
                            if (!isToday) return true;
                            if (now.getHours() >= 12 && period.timeWindow === 'Mañana') return false;
                            return true;
                          })
                          .map((period: any, wIdx: number) => (
                          <div key={wIdx} className="space-y-4">
                            <div className="flex flex-col gap-0.5 text-slate-400 border-b border-slate-50 pb-2">
                              <span className="text-lg font-black text-slate-900 uppercase tracking-tight">
                                {period.timeWindow}
                              </span>
                              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                                {period.timeWindow === 'Mañana' ? '07:00 - 13:00' : '14:00 - 20:00'}
                              </span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {period.spots.map((spot: any, sIdx: number) => (
                                <div 
                                  key={sIdx} 
                                  onClick={() => {
                                    setActiveSpot(spot);
                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                  }}
                                  className={`rounded-2xl p-5 border transition-all cursor-pointer relative group bg-orange-50/30 border-orange-100 hover:border-orange-300 hover:shadow-md`}
                                >
                                  <div className="absolute top-4 right-4 bg-white px-3 py-1 rounded-xl shadow-sm flex items-center gap-1.5 border border-slate-50">
                                    <Star size={14} className="text-orange-500 fill-orange-500" />
                                    <span className="text-sm font-black text-slate-900">{spot.score}/10</span>
                                  </div>
                                  <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black mb-3 shadow-sm transition-colors bg-orange-600 text-white`}>
                                    {sIdx + 1}
                                  </span>
                                  <h4 className="text-xl font-display font-extrabold italic tracking-tight text-slate-900 mb-2">{spot.name}</h4>
                                  <p className="text-base text-slate-600 font-medium leading-snug mb-4">{spot.description}</p>
                                  
                                  <div className="pt-4 border-t border-orange-100/50">
                                    <a 
                                      href={`https://www.google.com/maps/search/?api=1&query=${spot.lat},${spot.lng}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-[11px] font-black uppercase text-orange-600 flex items-center gap-1.5 hover:underline"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <Navigation size={12} /> Ver en Google Maps
                                    </a>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="flex items-center gap-3 text-slate-900">
                        <Navigation size={24} className="text-orange-600" />
                        <h2 className="text-2xl font-display font-extrabold italic tracking-tight">Mapa de points</h2>
                      </div>
                      <MapView 
                        spots={result.dailyResults[selectedDayIndex].bestSpots.flatMap((w: any) => w.spots)} 
                        activeSpot={activeSpot}
                        onSpotClick={(spot) => setActiveSpot(spot)}
                      />
                    </div>

                    {/* Pronóstico detallado (Estado de las cosas) */}
                    <EstadoDeLasCosas 
                      forecast={result.dailyResults[selectedDayIndex].forecast.filter((p: any) => {
                        const now = new Date();
                        const isToday = result.dailyResults[selectedDayIndex].date === now.toISOString().split('T')[0];
                        if (!isToday) return true;
                        if (now.getHours() >= 12 && (p.time || '').includes('Mañana')) return false;
                        return true;
                      })} 
                      astronomy={result.astronomy}
                    />

                    {/* Usage Stats Component */}
                    <DetailedUsageStats stats={usageStats} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading Overlay */}
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-white/95 backdrop-blur-2xl flex flex-col items-center justify-center p-6 text-center"
          >
            <div className="mb-12">
              <RadarLoader sport={sport} />
            </div>

            <p className="text-slate-600 text-sm mb-8 max-w-xs tracking-tight font-medium">
              Buscando datos en tiempo real. Esto puede demorar un rato.
            </p>
            
            <div className="w-full max-w-xs bg-slate-100 h-2 rounded-full overflow-hidden mb-4">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                className="h-full bg-orange-600"
              />
            </div>
            <p className="text-orange-600 font-black text-sm">{Math.round(progress)}%</p>

            <button 
              onClick={() => {
                if (abortControllerRef.current) {
                  abortControllerRef.current.abort();
                }
                setLoading(false);
              }}
              className="mt-16 px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 rounded-2xl font-black uppercase text-xs tracking-widest transition-all flex items-center gap-2 border border-slate-200 shadow-sm"
            >
              <AlertCircle size={14} /> Cancelar búsqueda
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Toast */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[110] w-full max-w-md px-4"
          >
            <div className="bg-red-600 text-white p-4 rounded-2xl shadow-2xl flex items-center gap-4">
              <AlertCircle size={24} className="shrink-0" />
              <p className="text-sm font-bold leading-tight flex-1">{error}</p>
              <button onClick={() => setError(null)} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
                <ArrowDown className="rotate-45" size={20} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
