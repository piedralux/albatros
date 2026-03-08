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

const MOCK_RESULT = {
  greeting: "¡Aloha, rider! Te compartimos un análisis de demostración (la API está saturada) para tu sesión.",
  astronomy: { sunrise: "06:15", sunset: "19:30" },
  dailyResults: [
    {
      date: "2026-03-03",
      dayName: "Martes 3",
      forecast: [
        { time: "09:00", windSpeed: 8, windDirection: "NW", waveHeight: 1.2, waveDirection: "SE", wavePeriod: 11, temperature: 18, cloudCover: 5 },
        { time: "15:00", windSpeed: 12, windDirection: "WNW", waveHeight: 1.3, waveDirection: "SE", wavePeriod: 11, temperature: 22, cloudCover: 25 }
      ],
      bestSpots: [
        {
          timeWindow: "Mañana (08:00 a 12:00)",
          spots: [
            { name: "Playa Grande", description: "Olas consistentes, viento offshore suave.", lat: -38.0285, lng: -57.5285 }
          ]
        }
      ],
      verdict: "El point del día es Playa Grande: condiciones épicas con viento offshore suave y swell consistente."
    },
    {
      date: "2026-03-04",
      dayName: "Miércoles 4",
      forecast: [
        { time: "09:00", windSpeed: 15, windDirection: "S", waveHeight: 1.5, waveDirection: "E", wavePeriod: 10, temperature: 17, cloudCover: 90 },
        { time: "15:00", windSpeed: 18, windDirection: "S", waveHeight: 1.8, waveDirection: "E", wavePeriod: 9, temperature: 19, cloudCover: 100 }
      ],
      bestSpots: [
        {
          timeWindow: "Tarde (13:00 a 17:00)",
          spots: [
            { name: "Waikiki", description: "Reparo del viento sur, ideal para longboard.", lat: -38.0575, lng: -57.5375 }
          ]
        }
      ],
      verdict: "El point del día es Waikiki: es el único lugar con reparo real del viento sur para que la ola no se rompa."
    }
  ]
};

const SYSTEM_INSTRUCTION = `Rol: Sos La posta del point, un asesor experto en deportes de tabla marítimos (Surf, Bodyboard, Windsurf, Kitesurf, SUP, Wingfoil). Tu rango de acción es EXCLUSIVAMENTE la costa atlántica de la provincia de Buenos Aires y Río Negro, Argentina, abarcando desde San Clemente del Tuyú hasta Carmen de Patagones. NO recomiendes spots en ríos, lagos ni lagunas.

Reglas de Análisis (El Protocolo La posta del point):
- Brevedad (CRÍTICO): Para reducir el tiempo de respuesta, mantén las descripciones muy breves (máximo 15 palabras por spot). No generes texto de relleno.
- Coordenadas Exactas (CRÍTICO): REGLA DE ORO PARA COORDENADAS: LOS PINES DEBEN ESTAR EXACTAMENTE SOBRE EL AGUA, A 50 METROS DE LA ORILLA. NUNCA EN LA TIERRA FIRME, NUNCA EN LA CIUDAD, NUNCA EN EL CAMPO. SIEMPRE EN EL AGUA AZUL. Los usuarios se quejan de que los pines caen en el pasto o en la calle. MUY IMPORTANTE: Verifica mentalmente la latitud y longitud. Si la coordenada cae en tierra firme, AJUSTA la coordenada moviéndola hacia el mar (por ejemplo, en la costa atlántica de Buenos Aires, el mar está al Este y Sur, así que suma a la longitud para ir al Este o resta a la latitud para ir al Sur). Sé extremadamente preciso con los decimales (ej: -38.0345, -57.5321). EL PIN DEBE CAER EN EL MAR, NO EN LA ARENA.
- Playas Prohibidas (CRÍTICO): NUNCA RECOMIENDES "La Perla" en Mar del Plata para Surf o Bodyboard. Es una playa muy pequeña y con una forma que apacigua mucho la ola. Evita siempre recomendar playas pequeñas, muy cerradas o con rompeolas que anulen el swell para deportes de ola.
- Resultados por Día: DEBES generar un análisis completo (pronóstico, spots y veredicto) para CADA UNO de los días dentro del rango de fechas solicitado.
- Horario Lógico (CRÍTICO): A partir de ahora, el análisis debe cubrir el DÍA COMPLETO, desde que amanece hasta que se va el sol. Este es el horario lógico para practicar estos deportes.
- Lógica de Spots Específicos (CRÍTICO):
  - Playa Grande (Mar del Plata): 
    - "El Yacht" es mejor con vientos del E, NE o SE suave, ya que la escollera protege. Es para un nivel más avanzado.
    - "Biología" es mejor cuando el viento es del N, NW o W (offshore) y el swell no es masivo. Es más amigable y suele estar más limpio si el Yacht está picado por viento cruzado.
    - Si el viento es del Norte, RECOMIENDA Biología sobre el Yacht. Si el viento es del Este/Sudeste, el Yacht suele tener mejor forma por el reparo de la piedra.
- Veredicto (CRÍTICO): El veredicto debe ser una recomendación experta, DECISIVA y SEGURA para la jornada completa. 
  1. Identifica el MEJOR spot del día.
  2. DEBES empezar el veredicto nombrando el spot ganador (ej: "El point del día para esta jornada es Playa Grande...").
  3. Explica brevemente POR QUÉ es el mejor.
  4. Si las condiciones son malas, ADVIÉRTELO claramente.
- Temperatura del Agua y Wetsuit: DEBES estimar la temperatura del agua y recomendar el traje adecuado (ej: 3/2mm, 4/3mm, shorty).
- Fuentes de Consulta (OBLIGATORIO): DEBES usar Google Search para obtener datos de Windguru, Surfline, Windy, estadodelmar.com.ar y lineup.surf.
- Consistencia: Los reportes para la misma fecha y lugar deben ser consistentes. Usa los datos reales encontrados en la búsqueda.
- Tono: Técnico pero cercano. Un lenguaje de "parador de playa" pero con la precisión de un radar náutico.

El output para el usuario debe ser un objeto JSON que contenga:
1. "greeting": Un saludo inicial. DEBE empezar con "¡Aloha, [apodo del deporte]!" (ej: rider, surfer, kiter) seguido de "Te compartimos el análisis para tu sesión de [Deporte] en [Ubicación]."
2. "astronomy": Un objeto con "sunrise" (ej: "06:30") y "sunset" (ej: "19:45").
3. "dailyResults": Un array de objetos, UNO POR CADA DÍA del rango solicitado. Cada objeto tiene:
   - "date": Fecha (ej: "2026-03-05")
   - "dayName": Nombre del día (ej: "Jueves 5")
   - "waterTemp": Temperatura del agua estimada (ej: 19)
   - "wetsuit": Recomendación de traje (ej: "3/2mm")
   - "forecast": Array con el pronóstico por horas de ESE día (Mañana, Mediodía, Tarde). Cada objeto debe tener "time" (ej: "Mañana (07:00)"), "windSpeed" (nudos), "windDirection" (ej: "NW"), "waveHeight" (metros, 0 si no aplica), "waveDirection" (ej: "SE"), "wavePeriod" (segundos, 0 si no aplica), "temperature" (°C) y "cloudCover" (porcentaje de nubosidad, de 0 a 100).
   - "bestSpots": Array de spots recomendados para ESE día, agrupados por franja horaria. Cada objeto tiene "timeWindow" y "spots" (máximo 3 spots). Cada spot tiene "name", "description" (explicación MUY corta), "lat", "lng" y "score" (un número del 1 al 10 que representa la calidad del spot para ese momento).
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
      'Buscando datos de condiciones...'
    ],
    'Bodyboard': [
      'Buscando rampas...',
      'Analizando el rebote en las escolleras...',
      'Chequeando la fuerza del labio...',
      'Escaneando tubos...',
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
      <div className="relative w-32 h-32 rounded-full border border-cyan-500/30 bg-slate-900/30 overflow-hidden shadow-[0_0_40px_rgba(6,182,212,0.15)] flex items-center justify-center">
        {/* Radar grid lines */}
        <div className="absolute inset-0 border-2 border-cyan-500/10 rounded-full m-4"></div>
        <div className="absolute inset-0 border-2 border-cyan-500/10 rounded-full m-10"></div>
        <div className="absolute w-full h-[1px] bg-cyan-500/20"></div>
        <div className="absolute h-full w-[1px] bg-cyan-500/20"></div>
        
        {/* Sweeping radar beam */}
        <motion.div 
          className="absolute inset-0 rounded-full"
          style={{
            background: 'conic-gradient(from 0deg, transparent 70%, rgba(6, 182, 212, 0.1) 80%, rgba(6, 182, 212, 0.5) 100%)'
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
        />
        
        {/* Blips */}
        <motion.div 
          className="absolute w-2 h-2 bg-cyan-400 rounded-full shadow-[0_0_10px_#22d3ee]"
          style={{ top: '30%', left: '60%' }}
          animate={{ opacity: [0, 1, 0], scale: [0.5, 1.5, 0.5] }}
          transition={{ duration: 2.5, repeat: Infinity, times: [0, 0.1, 1] }}
        />
        <motion.div 
          className="absolute w-1.5 h-1.5 bg-blue-400 rounded-full shadow-[0_0_10px_#60a5fa]"
          style={{ top: '65%', left: '35%' }}
          animate={{ opacity: [0, 1, 0], scale: [0.5, 1.5, 0.5] }}
          transition={{ duration: 2.5, repeat: Infinity, delay: 1, times: [0, 0.1, 1] }}
        />
        
        <Waves className="relative z-10 text-cyan-400 w-8 h-8 opacity-80" />
      </div>
      <div className="flex flex-col items-center gap-2">
        <h3 className="text-xl font-medium text-slate-200 min-h-[1.75rem]">
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
        <p className="text-sm text-cyan-400/80 animate-pulse">Cruzando datos de viento, mareas y geografía</p>
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
  if (cover < 20) return 'bg-slate-100 text-slate-800'; // Despejado
  if (cover < 50) return 'bg-slate-300 text-slate-800'; // Algo nublado
  if (cover < 80) return 'bg-slate-500 text-slate-100'; // Mayormente nublado
  return 'bg-slate-700 text-slate-100'; // Nublado
};

const EstadoDeLasCosas = ({ forecast, waterTemp, wetsuit }: { forecast: any[], waterTemp: number, wetsuit: string }) => {
  if (!forecast || forecast.length === 0) return null;

  const periods = forecast.slice(0, 3);

  return (
    <div className="bg-white rounded-[1.5rem] overflow-hidden border border-slate-100 shadow-xl">
      <div className="p-6 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="text-orange-600" size={24} />
          <h3 className="text-xl font-display font-extrabold italic tracking-tight text-slate-900">Pronóstico detallado</h3>
        </div>
        <div className="flex items-center gap-4 text-xs font-bold text-slate-400">
          <div className="flex items-center gap-1">
            <Sun size={14} className="text-yellow-500" />
            <span>06:38</span>
          </div>
          <div className="flex items-center gap-1">
            <Moon size={14} className="text-indigo-400" />
            <span>19:24</span>
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-xs font-extrabold uppercase tracking-widest text-slate-400 border-b border-slate-50">
              <th className="px-6 py-5 bg-slate-50/50">HORA</th>
              {periods.map((p, i) => (
                <th key={i} className="px-6 py-5 text-center bg-slate-50/30 text-sm text-slate-900 font-black">{p.time}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            <tr>
              <td className="px-6 py-5 text-sm font-extrabold text-slate-500 uppercase flex items-center gap-2">
                <Wind size={16} className="text-orange-600" /> Viento
              </td>
              {periods.map((p, i) => (
                <td key={i} className="px-6 py-5 text-center">
                  <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-black text-sm ${i === 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-yellow-50 text-yellow-700'}`}>
                    {p.windSpeed} <Navigation size={12} style={{ transform: `rotate(${getDirectionRotation(p.windDirection)}deg)` }} /> {p.windDirection}
                  </div>
                </td>
              ))}
            </tr>
            <tr>
              <td className="px-6 py-5 text-sm font-extrabold text-slate-500 uppercase flex items-center gap-2">
                <Waves size={16} className="text-orange-600" /> Olas
              </td>
              {periods.map((p, i) => (
                <td key={i} className="px-6 py-5 text-center">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-black text-sm bg-cyan-50 text-cyan-700">
                    {p.waveHeight} <Navigation size={12} style={{ transform: `rotate(${getDirectionRotation(p.waveDirection)}deg)` }} /> {p.waveDirection}
                  </div>
                </td>
              ))}
            </tr>
            <tr>
              <td className="px-6 py-5 text-sm font-extrabold text-slate-500 uppercase flex items-center gap-2">
                <Activity size={16} className="text-orange-600" /> Período
              </td>
              {periods.map((p, i) => (
                <td key={i} className="px-6 py-5 text-center">
                  <div className="inline-flex items-center gap-2 px-5 py-2 rounded-xl font-black text-sm bg-blue-50 text-blue-700">
                    {p.wavePeriod}s
                  </div>
                </td>
              ))}
            </tr>
            <tr>
              <td className="px-6 py-5 text-sm font-extrabold text-slate-500 uppercase flex items-center gap-2">
                <Cloud size={16} className="text-orange-600" /> Nubes
              </td>
              {periods.map((p, i) => (
                <td key={i} className="px-6 py-5 text-center">
                  <div className="inline-flex items-center gap-2 px-5 py-2 rounded-xl font-black text-sm bg-slate-100 text-slate-600">
                    {p.cloudCover}%
                  </div>
                </td>
              ))}
            </tr>
            <tr>
              <td className="px-6 py-5 text-sm font-extrabold text-slate-500 uppercase flex items-center gap-2">
                <Thermometer size={16} className="text-orange-600" /> Temp.
              </td>
              {periods.map((p, i) => (
                <td key={i} className="px-6 py-5 text-center">
                  <div className={`inline-flex items-center gap-2 px-5 py-2 rounded-xl font-black text-sm ${i === 0 ? 'bg-orange-50 text-orange-600' : 'bg-orange-100 text-orange-700'}`}>
                    {p.temperature}°
                  </div>
                </td>
              ))}
            </tr>
            <tr>
              <td className="px-6 py-5 text-sm font-extrabold text-slate-500 uppercase flex items-center gap-2">
                <Droplet size={16} className="text-orange-600" /> Agua
              </td>
              <td colSpan={2} className="px-6 py-5 text-center">
                <div className="inline-flex items-center gap-4">
                  <div className="flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-2 rounded-xl font-bold text-sm">
                    <Thermometer size={18} />
                    {waterTemp}°C
                  </div>
                  <div className="flex items-center gap-2 bg-orange-50 text-orange-700 px-4 py-2 rounded-xl font-bold text-sm">
                    <Shirt size={18} />
                    {wetsuit}
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
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
                  href={`https://www.google.com/maps/dir/?api=1&destination=${spot.lat},${spot.lng}`}
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
  const [mobility, setMobility] = useState(Number(searchParams.get('mob')) || 20);
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
          if (prev >= 98) return 98;
          // Slow down as it gets closer to 100
          const remaining = 100 - prev;
          const increment = (Math.random() * remaining) / 10;
          return Math.min(98, prev + increment);
        });
      }, 500);
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
      if (loading && abortControllerRef.current) {
        console.warn("Búsqueda cancelada por exceso de tiempo (timeout)");
        abortControllerRef.current.abort();
        setError("La búsqueda está demorando más de lo habitual. Por favor, intentá de nuevo o simplificá el rango de fechas.");
        setLoading(false);
      }
    }, 60000); // 60 seconds safety timeout

    const prompt = `
📍 Ubicación: ${location}
📅 RANGO SOLICITADO:
- Inicio: ${start.toLocaleDateString('es-AR')}
- Fin: ${end.toLocaleDateString('es-AR')}
🕒 HORA ACTUAL (Referencia): ${now.toLocaleString('es-AR')}

Instrucción para el modelo: Analizá cada día del rango solicitado. 
REGLA DE ORO: El análisis debe cubrir la JORNADA COMPLETA, desde el amanecer hasta el atardecer.
El veredicto debe centrarse en el mejor momento y lugar del día.

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
                    waterTemp: { type: Type.NUMBER, description: "Temperatura del agua estimada en °C" },
                    wetsuit: { type: Type.STRING, description: "Recomendación de traje (ej: 3/2mm)" },
                    forecast: {
                      type: Type.ARRAY,
                      description: "Pronóstico detallado por horas para este día. Debe incluir las franjas horarias que coincidan con el rango solicitado.",
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          time: { type: Type.STRING, description: "Período y Hora (ej: 'Mañana (08:00 - 12:00)')" },
                          windSpeed: { type: Type.NUMBER, description: "Velocidad del viento en nudos" },
                          windDirection: { type: Type.STRING, description: "Dirección del viento (ej: NW, S, SE)" },
                          waveHeight: { type: Type.NUMBER, description: "Altura de la ola en metros" },
                          waveDirection: { type: Type.STRING, description: "Dirección de la ola (ej: S, SE, E)" },
                          wavePeriod: { type: Type.NUMBER, description: "Período de la ola en segundos" },
                          temperature: { type: Type.NUMBER, description: "Temperatura ambiente en °C" },
                          cloudCover: { type: Type.NUMBER, description: "Porcentaje de nubosidad (0 a 100)" }
                        },
                        required: ["time", "windSpeed", "windDirection", "waveHeight", "waveDirection", "wavePeriod", "temperature", "cloudCover"]
                      }
                    },
                    bestSpots: {
                      type: Type.ARRAY,
                      description: "Los mejores spots para este día agrupados por franja horaria.",
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          timeWindow: { type: Type.STRING, description: "Franja horaria, ej: Mañana (08:00 a 12:00)" },
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
                  required: ["date", "dayName", "waterTemp", "wetsuit", "forecast", "bestSpots", "verdict"]
                }
              }
            },
            required: ["greeting", "astronomy", "dailyResults"],
          },
        },
      });

      if (abortControllerRef.current?.signal.aborted) return;

      const jsonStr = response.text || '{}';
      const parsed = JSON.parse(jsonStr);
      
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
                Para usar La posta del point sin límites, necesitás vincular tu propia API Key. 
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
        setError(`Hubo un error al consultar a La posta del point (${err.message || 'Error desconocido'}). Por favor, intentá de nuevo.`);
      }
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  // Auto-submit on load if URL has parameters
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get('loc') && !hasAutoSubmitted) {
      setHasAutoSubmitted(true);
      handleSubmit();
    }
  }, [hasAutoSubmitted, location, startDate, endDate, sport, mobility, objective]);

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
              <div className="w-full max-w-2xl text-center mb-12">
                  <h1 
                    className="text-5xl md:text-7xl font-display font-extrabold text-slate-900 mb-6 leading-[0.9] tracking-tight uppercase italic"
                  >
                    LA POSTA DEL <span className="text-orange-600">POINT</span>
                  </h1>
                <p className="text-xl text-slate-700 font-medium mx-auto">
                  Tu radar experto para deportes de tabla en la costa argentina.
                </p>
              </div>

              <div className="w-full max-w-3xl flex flex-col items-center">
                <motion.div 
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="w-full bg-white rounded-[1.5rem] p-5 md:p-6 shadow-2xl border-white/50"
                >
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {/* CIUDAD */}
                    <div className="space-y-2 relative">
                      <label className="text-xs font-extrabold text-slate-400 uppercase tracking-widest ml-1">CIUDAD</label>
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
                          className="w-full pl-12 pr-4 py-4 bg-white border-2 border-slate-100 rounded-2xl focus:outline-none focus:border-orange-500 transition-all text-lg font-semibold text-slate-800 shadow-sm"
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
                        <label className="text-xs font-extrabold text-slate-400 uppercase tracking-widest ml-1">Desde</label>
                        <input
                          type="date"
                          value={startDate}
                          min={getTodayDate()}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="w-full px-4 py-3 bg-white border-2 border-slate-100 rounded-2xl focus:outline-none focus:border-orange-500 text-sm font-bold text-slate-800 [color-scheme:light]"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-extrabold text-slate-400 uppercase tracking-widest ml-1">Hasta</label>
                        <input
                          type="date"
                          value={endDate}
                          min={startDate || getTodayDate()}
                          max={getMaxEndDate(startDate)}
                          onChange={(e) => setEndDate(e.target.value)}
                          className="w-full px-4 py-3 bg-white border-2 border-slate-100 rounded-2xl focus:outline-none focus:border-orange-500 text-sm font-bold text-slate-800 [color-scheme:light]"
                          required
                        />
                      </div>
                    </div>

                    {/* Deporte y Movilidad */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                      <div className="space-y-2">
                        <label className="text-xs font-extrabold text-slate-400 uppercase tracking-widest ml-1">Deporte</label>
                        <div className="grid grid-cols-3 gap-2 bg-slate-100 p-1 rounded-2xl">
                          {['Surf', 'Bodyboard', 'Kitesurf', 'Windsurf', 'SUP', 'Wingfoil'].map((s) => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => setSport(s)}
                              className={`py-3 rounded-xl text-xs font-extrabold transition-all ${sport === s ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center mb-1">
                          <label className="text-xs font-extrabold text-slate-400 uppercase tracking-widest ml-1">Movilidad</label>
                        </div>
                        <div className="pt-4 px-2">
                          <input
                            type="range"
                            min="0"
                            max="50"
                            step="10"
                            value={mobility}
                            onChange={(e) => setMobility(Number(e.target.value))}
                            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-orange-600"
                          />
                          <div className="flex justify-between text-[10px] font-black text-slate-400 mt-3 px-1">
                            {['0', '10', '20', '30', '40', '50'].map(val => (
                              <span key={val} className={mobility === Number(val) ? 'text-orange-600 scale-125 transition-transform' : ''}>
                                {val}KM
                              </span>
                            ))}
                          </div>
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
              © 2026 LA POSTA DEL POINT • Hecho con <span className="text-orange-500">♥</span> en la costa
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
            <header className="bg-white border-b border-slate-200 sticky top-0 z-50 px-6 py-4 flex justify-between items-center">
              <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView('form')}>
                <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center shadow-md rotate-3">
                  <Waves className="text-white" size={18} />
                </div>
                <span className="text-xl font-display font-extrabold tracking-tighter text-slate-900 uppercase italic">LA POSTA DEL <span className="text-orange-600">POINT</span></span>
              </div>
              <button 
                onClick={() => setView('form')}
                className="flex items-center gap-2 text-sm font-extrabold text-slate-500 hover:text-orange-600 transition-colors uppercase tracking-tight"
              >
                <ArrowDown className="rotate-90" size={16} />
                Nueva Consulta
              </button>
            </header>

            <div className="max-w-4xl mx-auto px-4 py-6 space-y-6" ref={resultsRef}>
              {/* Query Summary Card */}
              <div className="bg-orange-600 rounded-[1.5rem] p-4 text-white shadow-xl shadow-orange-200 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                    <MapPin size={20} />
                  </div>
                  <div>
                    <p className="text-xl font-display font-extrabold italic uppercase tracking-tight">{location}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-4">
                  <div className="bg-white/10 px-4 py-2 rounded-xl backdrop-blur-sm">
                    <span className="text-[10px] font-extrabold uppercase block opacity-60">Deporte</span>
                    <span className="text-sm font-bold">{sport}</span>
                  </div>
                  <div className="bg-white/10 px-4 py-2 rounded-xl backdrop-blur-sm">
                    <span className="text-[10px] font-extrabold uppercase block opacity-60">Rango</span>
                    <span className="text-sm font-bold">{startDate === endDate ? getDayOfWeek(startDate) : `${getDayOfWeek(startDate)} - ${getDayOfWeek(endDate)}`}</span>
                  </div>
                </div>
              </div>

              {/* Greeting */}
              {result?.greeting && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center max-w-2xl mx-auto"
                >
                  <p className="text-2xl font-display font-extrabold text-slate-900 italic uppercase tracking-tight leading-tight">
                    {result.greeting}
                  </p>
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
                    <div className="bg-white rounded-[1.5rem] p-8 md:p-10 shadow-xl border border-slate-100 relative overflow-hidden">
                      <div className="relative z-10 space-y-6">
                        <div className="flex items-center gap-3 text-orange-600">
                          <Target size={28} />
                          <h2 className="text-2xl font-display font-extrabold italic tracking-tight">Veredicto la posta del point</h2>
                        </div>
                        <p className="text-lg md:text-xl text-slate-800 font-medium leading-relaxed">
                          {result.dailyResults[selectedDayIndex].verdict}
                        </p>
                      </div>
                    </div>

                    <AdSlot className="h-32" />

                    {/* Pronóstico detallado (Estado de las cosas) */}
                    <EstadoDeLasCosas 
                      forecast={result.dailyResults[selectedDayIndex].forecast} 
                      waterTemp={result.dailyResults[selectedDayIndex].waterTemp}
                      wetsuit={result.dailyResults[selectedDayIndex].wetsuit}
                    />

                    {/* Spots Grid */}
                    <div className="space-y-6">
                      <div className="flex items-center gap-3 text-slate-900">
                        <MapPin size={24} className="text-orange-600" />
                        <h2 className="text-2xl font-display font-extrabold italic tracking-tight">Los points recomendados</h2>
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
                                  <div className="absolute top-4 right-4 bg-white px-2 py-1 rounded-lg shadow-sm flex items-center gap-1">
                                    <Star size={12} className="text-orange-500 fill-orange-500" />
                                    <span className="text-[10px] font-black text-slate-800">{spot.score}/10</span>
                                  </div>
                                  <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black mb-3 shadow-sm transition-colors bg-orange-600 text-white`}>
                                    {sIdx + 1}
                                  </span>
                                  <h4 className="text-lg font-display font-extrabold italic tracking-tight text-slate-900 mb-2">{spot.name}</h4>
                                  <p className="text-sm text-slate-600 font-medium leading-snug mb-4">{spot.description}</p>
                                  
                                  <div className="pt-4 border-t border-orange-200">
                                    <a 
                                      href={`https://www.google.com/maps/dir/?api=1&destination=${spot.lat},${spot.lng}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-[10px] font-black uppercase text-orange-600 flex items-center gap-1 hover:underline"
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
            className="fixed inset-0 z-[100] bg-white/90 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center"
          >
            <div className="relative mb-8">
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                className="w-32 h-32 border-4 border-slate-100 border-t-orange-600 rounded-full"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <Waves className="text-orange-600 animate-pulse" size={40} />
              </div>
            </div>
            <h2 className="text-3xl font-display font-extrabold italic uppercase tracking-tight text-slate-900 mb-4">
              Escaneando el horizonte...
            </h2>
            <p className="text-slate-500 font-bold uppercase tracking-widest text-xs mb-8">
              La posta del point está analizando vientos, mareas y swells para vos
            </p>
            <div className="w-full max-w-xs bg-slate-100 h-2 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                className="h-full bg-orange-600"
              />
            </div>
            <p className="mt-4 text-orange-600 font-black text-sm">{Math.round(progress)}%</p>
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
