import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import ReactMarkdown from 'react-markdown';
import { MapPin, Calendar, Activity, Car, Target, Waves, Wind, Navigation, Loader2, ChevronDown, ChevronUp, BarChart2, Share2, Check, Copy, Thermometer, Droplets, Cloud, CloudRain, Droplet, ArrowRight, Sun, Moon, AlertCircle, ArrowDown, Shirt, Star, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
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
  "Playa Grande (Biología)": { lat: -38.0265, lng: -57.5310 },
  "Playa Grande (El Yacht)": { lat: -38.0312, lng: -57.5325 },
  "Waikiki": { lat: -38.0705, lng: -57.5450 },
  "Serena Sur": { lat: -38.0865, lng: -57.5530 },
  "La Paloma": { lat: -38.0958, lng: -57.5540 },
  "Varese": { lat: -38.0142, lng: -57.5345 },
  "Cardiel": { lat: -37.9795, lng: -57.5410 },
  "Estrada": { lat: -37.9665, lng: -57.5440 },
  "Sun Rider": { lat: -37.9565, lng: -57.5470 },
  "Mariano": { lat: -38.0718, lng: -57.5470 },
  "Honu Beach": { lat: -38.0785, lng: -57.5500 },
  "El Faro": { lat: -38.0835, lng: -57.5520 },
  "Luna Roja": { lat: -38.1595, lng: -57.6390 },
  "Cruz del Sur": { lat: -38.1665, lng: -57.6470 },
  "RCT": { lat: -38.1765, lng: -57.6570 },
  "Punta Viracho": { lat: -38.2865, lng: -57.8170 },
  "El Muelle": { lat: -38.2765, lng: -57.8270 },
  "Pompeya": { lat: -38.2665, lng: -57.8330 },
  "Escollera Necochea (Arena)": { lat: -38.5880, lng: -58.7070 },
  "El Caño": { lat: -38.5938, lng: -58.7150 },
  "Karamawi": { lat: -38.6018, lng: -58.7250 },
  "La Hélice": { lat: -38.5778, lng: -58.6850 },
  "Monte Pasubio": { lat: -38.5718, lng: -58.6750 },
  "San Clemente (El Muelle)": { lat: -36.3565, lng: -56.6870 },
  "Santa Teresita": { lat: -36.5415, lng: -56.6870 },
  "Pinamar (El Muelle)": { lat: -37.1165, lng: -56.8570 },
  "Villa Gesell": { lat: -37.2565, lng: -56.9670 },
  "Mar Chiquita": { lat: -37.7565, lng: -57.4270 }
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
              .replace(/[^a-z0-9]/g, ""); // Quita todo lo que no sea letra o número
            
            const normalizedSpotName = normalize(spot.name);
            
            let matchedName = null;
            for (const dbName of Object.keys(SPOT_COORDINATES)) {
              const dbNormalized = normalize(dbName);
              
              if (normalizedSpotName === dbNormalized || 
                  normalizedSpotName.includes(dbNormalized) || 
                  dbNormalized.includes(normalizedSpotName)) {
                matchedName = dbName;
                break;
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
  USA ESTA LISTA OBLIGATORIA:
  - Mar del Plata:
    - Playa Grande (Biología): -38.0265, -57.5310
    - Playa Grande (El Yacht): -38.0312, -57.5325
    - Varese: -38.0142, -57.5345
    - Waikiki: -38.0705, -57.5450
    - Serena Sur: -38.0865, -57.5530
    - La Paloma: -38.0958, -57.5540
    - Cardiel: -37.9795, -57.5410
    - Estrada: -37.9665, -57.5440
    - Sun Rider: -37.9565, -57.5470
    - Mariano: -38.0718, -57.5470
    - Honu Beach: -38.0785, -57.5500
    - El Faro: -38.0835, -57.5520
  - Chapadmalal:
    - Luna Roja: -38.1595, -57.6390
    - Cruz del Sur: -38.1665, -57.6470
    - RCT: -38.1765, -57.6570
  - Miramar:
    - Punta Viracho: -38.2865, -57.8170
    - El Muelle: -38.2765, -57.8270
    - Pompeya: -38.2665, -57.8330
  - Necochea:
    - Escollera Necochea (Arena): -38.5880, -58.7070
    - El Caño: -38.5938, -58.7150
    - Karamawi: -38.6018, -58.7250
  - Quequén:
    - La Hélice: -38.5778, -58.6850
    - Monte Pasubio: -38.5718, -58.6750
- Criterio de Puntuación: Sé MUY exigente (1-10).
- Diversidad: No te quedes solo en Playa Grande. Recomienda Serena Sur con viento N/NW, Varese con viento S fuerte, etc.
- Horario Lógico (CRÍTICO): El análisis DEBE dividirse exactamente en 2 franjas horarias:
  1. Mañana (Ref: 08:00)
  2. Tarde (Ref: 17:00)
- Filtro de Tiempo (CRÍTICO): Si la consulta se realiza tarde en el día (después de las 14:00), omite la franja de la Mañana para el día de hoy.
- Clima (Simplificado): Usa EXCLUSIVAMENTE "Soleado", "Nublado", "Lluvia" o "Tormenta". No uses "Parcialmente nublado" ni términos largos.
- "forecast": Array de 2 objetos. Cada uno DEBE incluir:
  - "time": "Mañana (08:00)" o "Tarde (17:00)"
  - "weather": "Soleado", "Nublado", "Lluvia" o "Tormenta"
  - "airTemp": número
  - "waterTemp": número
  - "wetsuit": string
  - ... (viento, olas, etc.)
- "bestSpots": Array de 2 objetos: "Mañana" y "Tarde".
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
   - "weather": Estado del clima (ej: "Soleado", "Parcialmente Nublado", "Nublado", "Lluvia")
   - "airTemp": Temperatura del aire estimada (ej: 22)
   - "forecast": Array con el pronóstico por horas de ESE día. DEBE tener exactamente 4 objetos correspondientes a: "07:00", "11:00", "15:00" y "19:00".
   - "bestSpots": Array de spots recomendados para ESE día, agrupados por franja horaria. DEBE tener exactamente 4 objetos correspondientes a: "Mañana Temprano", "Mañana Tarde", "Tarde Temprano" y "Tarde Noche".
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

const CostEstimator = ({ stats, hasCustomKey }: { stats: { prompt: number, candidates: number, total: number } | null, hasCustomKey: boolean }) => {
  if (!stats) return null;

  // Pricing (approximate for Gemini 1.5 Flash)
  // Input: $0.075 / 1M tokens
  // Output: $0.30 / 1M tokens
  // Search Grounding: $0.035 per request
  const inputCost = (stats.prompt / 1000000) * 0.075;
  const outputCost = (stats.candidates / 1000000) * 0.30;
  const searchCost = 0.035; // Fixed cost per grounding request
  const totalCost = inputCost + outputCost + searchCost;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-4 p-3 bg-slate-950/50 border border-slate-800 rounded-xl flex flex-col gap-2"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <BarChart2 size={14} className="text-cyan-500" />
          <span>Monitor de Consumo (Estimado)</span>
        </div>
        <div className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-bold">
          {hasCustomKey ? 'PAGO POR USO' : 'NIVEL GRATUITO'}
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-slate-900/50 p-2 rounded-lg border border-slate-800/50">
          <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Tokens</p>
          <p className="text-sm font-mono text-slate-200">{stats.total.toLocaleString()}</p>
        </div>
        <div className="bg-slate-900/50 p-2 rounded-lg border border-slate-800/50">
          <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Búsqueda</p>
          <p className="text-sm font-mono text-slate-200">$0.035</p>
        </div>
        <div className="bg-slate-900/50 p-2 rounded-lg border border-slate-800/50">
          <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Costo Total</p>
          <p className="text-sm font-mono text-emerald-400 font-bold">${totalCost.toFixed(4)}</p>
        </div>
      </div>
      
      <p className="text-[9px] text-slate-600 italic">
        * Los costos son aproximados en USD. La mayoría de las veces, si estás en el "Free Tier", Google no te cobrará nada hasta superar un volumen muy alto.
      </p>
    </motion.div>
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

const InfoAgua = ({ forecast }: { forecast: any[] }) => {
  const getWeatherIcon = (condition: string = "") => {
    const c = condition.toLowerCase();
    if (c.includes('sol') || c.includes('despejado')) return <Sun size={20} className="text-yellow-500" />;
    if (c.includes('lluvia') || c.includes('tormenta')) return <CloudRain size={20} className="text-blue-400" />;
    if (c.includes('nublado')) return <Cloud size={20} className="text-slate-400" />;
    return <Sun size={20} className="text-yellow-500" />;
  };

  return (
    <div className="bg-slate-50/60 border-t border-slate-100/50 py-4 px-6 space-y-4">
      {forecast.map((p, idx) => (
        <div key={idx} className="grid grid-cols-2 md:grid-cols-4 items-center gap-4">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest w-16">{idx === 0 ? 'MAÑANA' : 'TARDE'}</span>
            <div className="flex items-center gap-2 text-slate-900 font-bold">
              {getWeatherIcon(p.weather)}
              <span className="text-sm whitespace-nowrap">{p.weather || 'Soleado'}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2 text-orange-600 font-bold">
            <Thermometer size={18} className="text-orange-500" />
            <span className="text-sm">{p.airTemp || 22}°C</span>
          </div>

          <div className="flex items-center gap-2 text-blue-700 font-bold">
            <Droplet size={18} className="text-blue-500" />
            <span className="text-sm">{p.waterTemp}°C</span>
          </div>

          <div className="flex items-center gap-2 text-orange-700 font-bold">
            <Shirt size={18} className="text-orange-500" />
            <span className="text-sm whitespace-nowrap">{p.wetsuit}</span>
          </div>
        </div>
      ))}
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
    <div className="bg-white rounded-[1.5rem] overflow-hidden border border-slate-100 shadow-xl">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-6 border-b border-slate-100 flex items-center justify-between hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Activity className="text-orange-600" size={24} />
          <h3 className="text-xl font-display font-extrabold italic tracking-tight text-slate-900">Pronóstico detallado</h3>
        </div>
        <div className="flex items-center gap-6">
          <div className="hidden md:flex items-center gap-4 text-sm font-bold text-slate-500">
            <span className="text-sm uppercase tracking-widest text-slate-400">Sol:</span>
            <div className="flex items-center gap-1">
              <Sun size={16} className="text-yellow-500" />
              <span>{astronomy.sunrise}</span>
            </div>
            <div className="flex items-center gap-1">
              <Moon size={16} className="text-indigo-400" />
              <span>{astronomy.sunset}</span>
            </div>
          </div>
          {isOpen ? <ChevronUp className="text-slate-400" /> : <ChevronDown className="text-slate-400" />}
        </div>
      </button>
      
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
                      <Cloud size={16} className="text-orange-600" /> Clima
                    </td>
                    {periods.map((p, i) => (
                      <td key={i} className="px-6 py-2 text-center">
                        <div className="inline-flex items-center justify-center gap-2 w-32 py-1.5 rounded-xl font-black text-base bg-slate-50 text-slate-700">
                          {p.weather || 'Soleado'}
                        </div>
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-6 py-2 text-sm font-extrabold text-slate-500 uppercase flex items-center gap-2">
                      <Thermometer size={16} className="text-orange-600" /> Aire
                    </td>
                    {periods.map((p, i) => (
                      <td key={i} className="px-6 py-2 text-center">
                        <div className="inline-flex items-center justify-center gap-2 w-32 py-1.5 rounded-xl font-black text-base bg-orange-50 text-orange-700">
                          {p.airTemp}°C
                        </div>
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-6 py-2 text-sm font-extrabold text-slate-500 uppercase flex items-center gap-2">
                      <Droplet size={16} className="text-orange-600" /> Agua
                    </td>
                    {periods.map((p, i) => (
                      <td key={i} className="px-6 py-2 text-center">
                        <div className="inline-flex items-center justify-center gap-2 w-32 py-1.5 rounded-xl font-black text-base bg-blue-50 text-blue-700">
                          {p.waterTemp}°C
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

const MapView = ({ spots, activeSpot, onSpotClick }: { spots: any[], activeSpot: any, onSpotClick: (spot: any) => void }) => {
  const center: [number, number] = activeSpot ? [activeSpot.lat, activeSpot.lng] : (spots.length > 0 ? [spots[0].lat, spots[0].lng] : [-38.0055, -57.5426]);
  
  return (
    <div className="h-[300px] lg:h-[400px] w-full rounded-[1.5rem] overflow-hidden border-4 border-white shadow-xl relative z-0">
      <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
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
              <div className="p-2">
                <h4 className="font-bold text-slate-900">{spot.name}</h4>
                <p className="text-xs text-slate-600 mb-2">{spot.description}</p>
                <a 
                  href={`https://www.google.com/maps/search/?api=1&query=${spot.lat},${spot.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] font-black uppercase text-orange-600 hover:underline flex items-center gap-1"
                >
                  <Navigation size={10} /> Cómo llegar
                </a>
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
    <div className="min-h-screen font-sans selection:bg-orange-200">
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

            {/* Header */}
            <header className="relative z-10 p-6 flex justify-end items-center">
              <button 
                onClick={() => window.aistudio?.openSelectKey?.()}
                className="p-2 hover:bg-white/50 rounded-full transition-colors"
                title="Configurar API Key"
              >
                <AlertCircle size={20} className={hasCustomKey ? "text-green-600" : "text-slate-400"} />
              </button>
            </header>

            {/* Main Form Hero */}
            <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-12">
                  <div className="w-full max-w-4xl text-center mb-12">
                    <h1 
                      className="text-4xl sm:text-5xl md:text-7xl font-display font-extrabold text-slate-900 mb-6 leading-[0.9] tracking-tight uppercase italic whitespace-nowrap inline-block"
                    >
                      SURF<span className="text-orange-600">POINT</span>
                    </h1>
                    <p className="text-xl text-slate-900 font-extrabold mx-auto max-w-2xl drop-shadow-[0_0_8px_rgba(255,255,255,1)]">
                      Tu radar experto para deportes de tabla en la costa argentina.
                    </p>
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

                  <div className="mt-12 space-y-4">
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] text-center">Espacio Publicitario</p>
                    <AdSlot className="h-32 bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl" />
                  </div>
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
            {/* Results Header */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-50 px-6 py-4 flex items-center justify-between relative">
              <button 
                onClick={() => setView('form')}
                className="flex items-center gap-2 text-sm font-extrabold text-slate-500 hover:text-orange-600 transition-colors uppercase tracking-tight"
              >
                <ArrowDown className="rotate-90" size={16} />
                Nueva Consulta
              </button>

              <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 cursor-pointer" onClick={() => setView('form')}>
                <span className="text-xl md:text-2xl font-display font-extrabold tracking-tighter text-slate-900 uppercase italic">SURF<span className="text-orange-600">POINT</span></span>
              </div>
              
              <div className="w-24" /> {/* Spacer to balance the layout */}
            </header>

            <div className="max-w-4xl mx-auto px-4 py-8 space-y-12" ref={resultsRef}>
              <div className="space-y-4">
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] text-center">Espacio Publicitario</p>
                <AdSlot className="h-24 md:h-32 bg-white border-2 border-dashed border-slate-100 rounded-3xl mb-8" />
              </div>
              
              {/* Greeting */}
              {result?.greeting && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center px-4"
                >
                  <h2 className="text-xl md:text-3xl font-display font-extrabold italic tracking-tight text-slate-900 leading-tight">
                    {result.greeting}
                  </h2>
                </motion.div>
              )}

              {/* Day Selection Tabs */}
              {result?.dailyResults && result.dailyResults.length > 1 && (
                <div className="flex justify-center gap-2 overflow-x-auto pb-2 no-scrollbar">
                  {result.dailyResults.map((day: any, idx: number) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedDayIndex(idx)}
                      className={`px-6 py-3 rounded-2xl text-sm font-extrabold transition-all whitespace-nowrap ${selectedDayIndex === idx ? 'bg-orange-600 text-white shadow-lg shadow-orange-200' : 'bg-white text-slate-500 hover:bg-slate-100 border border-slate-200'}`}
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
                    {/* Verdict Card */}
                    <div className="bg-white rounded-[1.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.1)] border-2 border-slate-100 relative overflow-hidden">
                      <div className="p-8 md:p-10 space-y-8">
                        <div className="flex items-center gap-3 text-orange-600">
                          <Target size={28} />
                          <h2 className="text-2xl md:text-3xl font-display font-extrabold italic tracking-tight">La posta</h2>
                        </div>
                        <div className="text-base md:text-lg text-slate-800 font-medium leading-relaxed markdown-body">
                          <ReactMarkdown>{result.dailyResults[selectedDayIndex].verdict}</ReactMarkdown>
                        </div>
                      </div>

                      {/* Info Agua (Integrated - Bleeding to edges) */}
                      <InfoAgua 
                        forecast={result.dailyResults[selectedDayIndex].forecast}
                      />
                    </div>

                    {/* Pronóstico detallado (Estado de las cosas) */}
                    <EstadoDeLasCosas 
                      forecast={result.dailyResults[selectedDayIndex].forecast} 
                      astronomy={result.astronomy}
                    />

                    {/* Spots Grid (Moved up) */}
                    <div className="space-y-6">
                      <div className="flex items-center gap-3 text-slate-900">
                        <MapPin size={20} className="text-orange-600" />
                        <h2 className="text-xl font-display font-extrabold italic tracking-tight">Los points del día</h2>
                      </div>
                      
                      <div className="grid grid-cols-1 gap-6">
                        {result.dailyResults[selectedDayIndex].bestSpots.map((window: any, wIdx: number) => (
                          <div key={wIdx} className="bg-white rounded-[1.5rem] p-6 shadow-lg border border-slate-100 space-y-6">
                            <div className="flex items-center gap-3 text-slate-400">
                              <Calendar size={18} />
                              <span className="text-sm font-extrabold uppercase tracking-widest">{window.timeWindow}</span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              {window.spots.map((spot: any, sIdx: number) => (
                                <div 
                                  key={sIdx} 
                                  onClick={() => {
                                    setActiveSpot(spot);
                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                  }}
                                  className={`rounded-2xl p-4 border transition-all cursor-pointer relative group bg-orange-50 border-orange-200`}
                                >
                                  <div className="absolute top-4 right-4 bg-white px-3 py-1.5 rounded-xl shadow-md flex items-center gap-1.5 border border-slate-100">
                                    <Star size={16} className="text-orange-500 fill-orange-500" />
                                    <span className="text-sm font-black text-slate-900">{spot.score}/10</span>
                                  </div>
                                  <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black mb-3 shadow-sm transition-colors bg-orange-600 text-white`}>
                                    {sIdx + 1}
                                  </span>
                                  <h4 className="text-lg font-display font-extrabold italic tracking-tight text-slate-900 mb-2">{spot.name}</h4>
                                  <p className="text-base text-slate-600 font-medium leading-relaxed mb-4">{spot.description}</p>
                                  
                                  <div className="pt-4 border-t border-orange-200">
                                    <a 
                                      href={`https://www.google.com/maps/search/?api=1&query=${spot.lat},${spot.lng}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs font-black uppercase text-orange-600 flex items-center gap-1 hover:underline"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <Navigation size={14} /> Ver en Google Maps
                                    </a>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <AdSlot className="h-32" />

                    {/* Map View */}
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

                    <AdSlot className="h-32 mt-8" />
                    
                    <CostEstimator stats={usageStats} hasCustomKey={!!process.env.API_KEY} />
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
