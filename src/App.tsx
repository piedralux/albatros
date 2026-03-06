import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import ReactMarkdown from 'react-markdown';
import { MapPin, Calendar, Activity, Car, Target, Waves, Wind, Navigation, Loader2, ChevronDown, ChevronUp, BarChart2, Share2, Check, Copy, Thermometer, Droplets, Cloud, CloudRain, Droplet, ArrowRight, Sun, Moon, AlertCircle, ArrowDown } from 'lucide-react';
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

const SYSTEM_INSTRUCTION = `Rol: Sos Albatros, un asesor experto en deportes de tabla marítimos (Surf, Bodyboard, Windsurf, Kitesurf, SUP, Wingfoil). Tu rango de acción es EXCLUSIVAMENTE la costa atlántica de la provincia de Buenos Aires y Río Negro, Argentina, abarcando desde San Clemente del Tuyú hasta Carmen de Patagones. NO recomiendes spots en ríos, lagos ni lagunas.

Reglas de Análisis (El Protocolo Albatros):
- Brevedad (CRÍTICO): Para reducir el tiempo de respuesta, mantén las descripciones muy breves (máximo 15 palabras por spot). No generes texto de relleno.
- Coordenadas Exactas (CRÍTICO): REGLA DE ORO PARA COORDENADAS: LOS PINES DEBEN ESTAR EXACTAMENTE SOBRE EL AGUA, A 50 METROS DE LA ORILLA. NUNCA EN LA TIERRA FIRME, NUNCA EN LA CIUDAD, NUNCA EN EL CAMPO. SIEMPRE EN EL AGUA AZUL. Los usuarios se quejan de que los pines caen en el pasto o en la calle. MUY IMPORTANTE: Verifica mentalmente la latitud y longitud. Si la coordenada cae en tierra firme, AJUSTA la coordenada moviéndola hacia el mar (por ejemplo, en la costa atlántica de Buenos Aires, el mar está al Este y Sur, así que suma a la longitud para ir al Este o resta a la latitud para ir al Sur). Sé extremadamente preciso con los decimales (ej: -38.0345, -57.5321). EL PIN DEBE CAER EN EL MAR, NO EN LA ARENA.
- Playas Prohibidas (CRÍTICO): NUNCA RECOMIENDES "La Perla" en Mar del Plata para Surf o Bodyboard. Es una playa muy pequeña y con una forma que apacigua mucho la ola. Evita siempre recomendar playas pequeñas, muy cerradas o con rompeolas que anulen el swell para deportes de ola.
- Resultados por Día: DEBES generar un análisis completo (pronóstico, spots y veredicto) para CADA UNO de los días dentro del rango de fechas solicitado.
- Tabla de Pronóstico y Spots: DEBES generar el análisis para TODAS las franjas horarias que se solapen con el rango solicitado por el usuario en cada día.
  - Si el usuario pide de 08:00 a 23:59, DEBES mostrar "Mañana" (08:00-13:00) Y "Tarde" (13:00-atardecer). No omitas la tarde si el rango la incluye.
  - Si el rango solicitado es específico (ej: 14:00 a 18:00), genera solo la franja de la "Tarde".
  - NO omitas franjas horarias que estén dentro del interés del usuario.
- Veredicto (CRÍTICO): El veredicto debe ser una recomendación experta, DECISIVA y SEGURA. 
  1. Identifica el MEJOR spot del día basándote en el cruce de viento y swell.
  2. DEBES empezar el veredicto nombrando el spot ganador (ej: "El point del día es Playa Grande...").
  3. Lógica de Sesión:
     - Si el mismo spot es el mejor mañana y tarde: "Quedate todo el día en [Spot], las condiciones se mantienen firmes".
     - Si cambian: "Arrancá en [Spot A] pero después del mediodía cargá las tablas y movete a [Spot B] porque el viento rota".
     - Si la tarde es mala: "Aprovechá la mañana en [Spot]; a la tarde el mar se rompe, guardá energías para mañana".
  4. Explica brevemente POR QUÉ es el mejor.
  5. Si las condiciones son malas, ADVIÉRTELO claramente.
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
   - "forecast": Array con el pronóstico por horas de ESE día. Cada objeto debe tener "time" (ej: "Mañana (06:35 - 13:00)"), "windSpeed" (nudos), "windDirection" (ej: "NW"), "waveHeight" (metros, 0 si no aplica), "waveDirection" (ej: "SE"), "wavePeriod" (segundos, 0 si no aplica), "temperature" (°C) y "cloudCover" (porcentaje de nubosidad, de 0 a 100).
   - "bestSpots": Array de spots recomendados para ESE día, agrupados por franja horaria. Cada objeto tiene "timeWindow" y "spots" (máximo 3 spots). Cada spot tiene "name", "description" (explicación MUY corta), "lat" y "lng".
   - "verdict": Veredicto experto y decidido.`;

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
  <div className={`bg-slate-900/30 backdrop-blur-md border border-slate-800 border-dashed flex flex-col items-center justify-center text-slate-500 text-sm p-4 rounded-xl ${className}`}>
    <span className="font-medium text-slate-600 mb-1">Espacio Publicitario</span>
    <span className="text-xs opacity-50">(Google Ads)</span>
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
      'Consultando Windguru y Surfline...'
    ],
    'Bodyboard': [
      'Buscando rampas...',
      'Analizando el rebote en las escolleras...',
      'Chequeando la fuerza del labio...',
      'Escaneando tubos...',
      'Consultando Windguru y Surfline...'
    ],
    'Windsurf': [
      'Midiendo rachas...',
      'Buscando viento constante...',
      'Analizando el planeo...',
      'Chequeando la dirección del viento...',
      'Consultando Windguru y Surfline...'
    ],
    'Kitesurf': [
      'Escaneando la ventana de viento...',
      'Buscando el mejor lanzamiento...',
      'Analizando la densidad del aire...',
      'Chequeando condiciones para saltar...',
      'Consultando Windguru y Surfline...'
    ],
    'SUP': [
      'Buscando aguas tranquilas...',
      'Analizando la deriva...',
      'Chequeando el viento de costa...',
      'Escaneando el horizonte...',
      'Consultando Windguru y Surfline...'
    ],
    'Wingfoil': [
      'Analizando el despegue...',
      'Buscando el mejor foil track...',
      'Midiendo la presión del viento...',
      'Chequeando el choppy...',
      'Consultando Windguru y Surfline...'
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

const getCloudCoverColor = (cover: number) => {
  if (cover < 20) return 'bg-slate-100 text-slate-800'; // Despejado
  if (cover < 50) return 'bg-slate-300 text-slate-800'; // Algo nublado
  if (cover < 80) return 'bg-slate-500 text-slate-100'; // Mayormente nublado
  return 'bg-slate-700 text-slate-100'; // Nublado
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
  ]
};

const HERO_IMAGES = SPORT_IMAGES['Surf']; // Default fallback

export default function App() {
  const getTomorrowDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0];
  };

  const searchParams = new URLSearchParams(window.location.search);

  const [location, setLocation] = useState(searchParams.get('loc') || '');
  const [startDate, setStartDate] = useState(searchParams.get('sDate') || getTomorrowDate());
  const [startTime, setStartTime] = useState(searchParams.get('sTime') || '08:00');
  const [endDate, setEndDate] = useState(searchParams.get('eDate') || getTomorrowDate());
  const [endTime, setEndTime] = useState(searchParams.get('eTime') || '12:00');
  const [sport, setSport] = useState(searchParams.get('sport') || 'Surf');
  const [mobility, setMobility] = useState(Number(searchParams.get('mob')) || 10);
  const [objective, setObjective] = useState(searchParams.get('obj') || '');
  
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
  }, [result, loading]);

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
          if (prev >= 95) return 95;
          const increment = Math.random() * 8;
          return Math.min(95, prev + increment);
        });
      }, 800);
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

    if (!location || !startDate || !startTime || !endDate || !endTime) {
      setError('Por favor, completá la ubicación, fechas y horarios.');
      return;
    }

    playClick();

    const start = new Date(`${startDate}T${startTime}`);
    const end = new Date(`${endDate}T${endTime}`);
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
      sTime: startTime,
      eDate: endDate,
      eTime: endTime,
      sport,
      mob: mobility.toString(),
      obj: objective
    });
    window.history.pushState({}, '', `?${params.toString()}`);

    // Cache key based on search parameters to save API quota
    const cacheKey = `albatros_${params.toString()}`;
    const cachedEntry = localStorage.getItem(cacheKey);
    const CACHE_TTL = 2 * 60 * 60 * 1000; // 2 hours in milliseconds

    if (cachedEntry) {
      try {
        const { data, timestamp } = JSON.parse(cachedEntry);
        const age = Date.now() - timestamp;
        
        if (age < CACHE_TTL) {
          console.log("Cargando desde caché para ahorrar cuota de API...");
          setResult(data);
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

    const prompt = `
📍 Ubicación: ${location}
📅 RANGO SOLICITADO:
- Inicio: ${start.toLocaleString('es-AR')}
- Fin: ${end.toLocaleString('es-AR')}

Instrucción para el modelo: Analizá cada día del rango. Para cada día, si el horario solicitado incluye la mañana (antes de las 13:00), mostrá la franja "Mañana". Si incluye la tarde (después de las 13:00), mostrá la franja "Tarde". Si incluye ambas, MOSTRÁ AMBAS.

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
                      description: "Los mejores spots para este día agrupados por franja horaria. Solo incluye franjas que estén dentro del rango solicitado.",
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
                              },
                              required: ["name", "description", "lat", "lng"]
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
                Para usar Albatros sin límites, necesitás vincular tu propia API Key. 
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
        setError(`Hubo un error al consultar a Albatros (${err.message || 'Error desconocido'}). Por favor, intentá de nuevo.`);
      }
    } finally {
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
  }, [hasAutoSubmitted, location, startDate, startTime, endDate, endTime, sport, mobility, objective]);

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
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-cyan-900 selection:text-cyan-50 relative">
      {/* Global Background Image for Hero Area */}
      <div className="absolute top-0 left-0 w-full h-[850px] lg:h-[950px] z-0 overflow-hidden pointer-events-none">
        <img 
          src={heroImage}
          alt="Hero background"
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover animate-kenburns will-change-transform"
        />
        {/* Overlays for readability and smooth fade to background */}
        <div className="absolute inset-0 bg-slate-950/20"></div>
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/40 via-transparent to-transparent h-32"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent"></div>
      </div>

      {/* Header */}
      <header className="bg-slate-950/60 backdrop-blur-md border-b border-slate-800/50 text-white py-4 px-4 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="w-10 md:w-32"></div> {/* Spacer for centering logo */}
          <img src="https://res.cloudinary.com/dktrerrgh/image/upload/v1772578506/logo_sgdozx.png" alt="Albatros" className="h-[50px] md:h-[70px] w-auto" />
          
          <div className="flex items-center gap-3">
            {hasCustomKey && (
              <div className="hidden md:flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Radar Premium</span>
              </div>
            )}
            <button 
              onClick={handleOpenKeySelector}
              className={`p-2 rounded-xl border transition-all ${hasCustomKey ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:text-cyan-400'}`}
              title={hasCustomKey ? "API Key Vinculada" : "Vincular API Key propia"}
            >
              <Target size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* Intro Text */}
      <section className="relative z-10 w-full flex items-center justify-center pt-24 pb-16 lg:pt-32 lg:pb-24">
        {/* Content */}
        <div className="max-w-5xl mx-auto px-4 text-center flex flex-col items-center">
          <h1 className="text-4xl md:text-5xl font-display text-white mb-6 tracking-wider drop-shadow-lg uppercase max-w-[90%] md:max-w-none">
            Recomendador de points acuaticos
          </h1>
          <div className="w-full max-w-[90%] md:max-w-[800px]">
            <p className="text-slate-200 text-xl md:text-2xl leading-relaxed drop-shadow-md font-normal">
              ¡Te tiramos la posta del mejor point para tu metida al mar!
            </p>
          </div>
        </div>
      </section>

      {/* Top Ad Slots */}
      <div className="relative z-10 max-w-5xl mx-auto px-4 py-2 grid grid-cols-1 md:grid-cols-2 gap-4">
        <AdSlot className="h-24 w-full" />
        <AdSlot className="h-24 w-full hidden md:flex" />
      </div>

      <main className="relative z-10 max-w-5xl mx-auto p-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Form Section */}
        <section className="lg:col-span-5 bg-slate-900/60 backdrop-blur-md rounded-2xl shadow-xl border border-slate-800/80 p-6 flex flex-col gap-6">
          <h2 className="text-xl font-semibold flex items-center gap-2 text-white">
            <Navigation className="text-cyan-500" size={20} />
            Configurá tu sesión
          </h2>
          
          <form onSubmit={handleSubmit} className="space-y-5">
            
            {/* Ubicación */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <MapPin size={16} className="text-slate-500" />
                Ubicación (Costa Atlántica)
              </label>
              <input
                type="text"
                placeholder="Ej: Mar del Plata / Necochea / Monte Hermoso"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all text-slate-200 placeholder-slate-600"
                required
              />
              {location && location.length > 3 && (
                <div className="mt-2 h-32 w-full rounded-xl overflow-hidden border border-slate-800 opacity-80 hover:opacity-100 transition-opacity">
                  <iframe
                    width="100%"
                    height="100%"
                    style={{ border: 0, filter: 'invert(90%) hue-rotate(180deg)' }}
                    loading="lazy"
                    allowFullScreen
                    referrerPolicy="no-referrer-when-downgrade"
                    src={`https://www.google.com/maps?q=${encodeURIComponent(location + ', Argentina')}&output=embed`}
                  ></iframe>
                </div>
              )}
            </div>

            {/* Fechas */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <Calendar size={16} className="text-slate-500" />
                Fecha y Franja Horaria
              </label>
              
              <div className="space-y-3">
                {/* Desde */}
                <div className="bg-slate-950/30 p-3 rounded-xl border border-slate-800 space-y-2">
                  <span className="text-xs text-cyan-500 font-medium uppercase tracking-wider block">Desde</span>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-cyan-500/50 focus-within:border-cyan-500">
                      <span className="text-sm text-slate-400 font-medium w-8">{getDayOfWeek(startDate)}</span>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full bg-transparent focus:outline-none text-sm text-slate-200 [color-scheme:dark]"
                        required
                      />
                    </div>
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-28 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 text-sm text-slate-200 [color-scheme:dark]"
                      required
                    />
                  </div>
                </div>

                {/* Hasta */}
                <div className="bg-slate-950/30 p-3 rounded-xl border border-slate-800 space-y-2">
                  <span className="text-xs text-cyan-500 font-medium uppercase tracking-wider block">Hasta (Máx 3 días)</span>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-cyan-500/50 focus-within:border-cyan-500">
                      <span className="text-sm text-slate-400 font-medium w-8">{getDayOfWeek(endDate)}</span>
                      <input
                        type="date"
                        value={endDate}
                        min={startDate}
                        max={getMaxEndDate(startDate)}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full bg-transparent focus:outline-none text-sm text-slate-200 [color-scheme:dark]"
                        required
                      />
                    </div>
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-28 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 text-sm text-slate-200 [color-scheme:dark]"
                      required
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Deporte */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <Activity size={16} className="text-slate-500" />
                Deporte
              </label>
              <select
                value={sport}
                onChange={(e) => setSport(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all appearance-none text-slate-200"
              >
                <option value="Surf">Surf</option>
                <option value="Bodyboard">Bodyboard</option>
                <option value="Windsurf">Windsurf</option>
                <option value="Kitesurf">Kitesurf</option>
                <option value="SUP">SUP</option>
                <option value="Wingfoil">Wingfoil</option>
              </select>
            </div>

            {/* Movilidad */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-300 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Car size={16} className="text-slate-500" />
                  Movilidad
                </div>
                <span className="text-cyan-400 font-semibold bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-md text-xs">
                  Hasta {mobility} km
                </span>
              </label>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={mobility}
                onChange={(e) => setMobility(Number(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              />
              <div className="flex justify-between text-xs text-slate-500 px-1">
                <span>0 km</span>
                <span>100 km</span>
              </div>
            </div>

            {/* Objetivo */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <Target size={16} className="text-slate-500" />
                Objetivo <span className="text-slate-600 font-normal text-xs">(Opcional)</span>
              </label>
              <textarea
                placeholder="Ej: Busco rampas para volar / Busco mar calmo para remar"
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                rows={2}
                className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all resize-none text-sm text-slate-200 placeholder-slate-600"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 text-red-400 text-sm rounded-xl border border-red-500/20">
                {error}
              </div>
            )}

            <button
              type="submit"
              className={`relative w-full text-white font-medium py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg overflow-hidden ${
                loading 
                  ? 'bg-red-600 hover:bg-red-500 shadow-red-900/20' 
                  : 'bg-cyan-600 hover:bg-cyan-500 shadow-cyan-900/20'
              }`}
            >
              {loading && (
                <div 
                  className="absolute left-0 top-0 bottom-0 bg-white/20 transition-all duration-500 ease-out"
                  style={{ width: `${progress}%` }}
                />
              )}
              <div className="relative z-10 flex items-center gap-2">
                {loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>Cancelar búsqueda... {Math.round(progress)}%</span>
                  </>
                ) : (
                  <>
                    <Wind size={18} />
                    <span>Consultar a Albatros</span>
                  </>
                )}
              </div>
            </button>
            
            {loading && (
              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-[10px] text-slate-500 text-center mt-2 italic"
              >
                * Albatros está analizando las condiciones. Esto puede demorar unos segundos.
              </motion.p>
            )}
          </form>

          {/* Ad Slot Sidebar */}
          <AdSlot className="flex-1 min-h-[200px] w-full mt-4" />
          
          {/* Cost Estimator */}
          <CostEstimator stats={usageStats} hasCustomKey={hasCustomKey} />
        </section>

        {/* Results Section */}
        <section className="lg:col-span-7" ref={resultsRef}>
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-slate-900/30 backdrop-blur-md rounded-2xl border border-slate-800 border-dashed p-8 h-full flex flex-col items-center justify-center lg:justify-start lg:pt-40 text-center min-h-[400px]"
              >
                <RadarLoader sport={sport} />
              </motion.div>
            ) : result ? (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-slate-900/60 backdrop-blur-md rounded-2xl shadow-xl border border-slate-800/80 p-6 md:p-8 h-full flex flex-col"
              >
                <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <h2 className="text-xl md:text-2xl font-medium text-slate-100 leading-tight text-center md:text-left">
                    {result.greeting}
                  </h2>
                  
                  {isFromCache && (
                    <div className="flex items-center justify-center md:justify-end gap-2">
                      <div className="px-3 py-1 bg-slate-800/80 backdrop-blur-sm border border-slate-700 rounded-full flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          Datos en Caché ({new Date(cacheTimestamp!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                        </span>
                      </div>
                      <button 
                        onClick={() => {
                          const cacheKey = `albatros_${new URLSearchParams({
                            loc: location,
                            sDate: startDate,
                            sTime: startTime,
                            eDate: endDate,
                            eTime: endTime,
                            sport,
                            mob: mobility.toString(),
                            obj: objective
                          }).toString()}`;
                          localStorage.removeItem(cacheKey);
                          handleSubmit();
                        }}
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-cyan-400 rounded-lg border border-slate-700 transition-colors"
                        title="Forzar actualización"
                      >
                        <Loader2 size={14} className={loading ? "animate-spin" : ""} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Tabs */}
                {result.dailyResults && result.dailyResults.length > 0 && (
                  <div className="flex overflow-x-auto gap-2 mb-6 pb-2 scrollbar-hide">
                    {result.dailyResults.map((day: any, index: number) => (
                      <button
                        key={index}
                        onClick={() => setSelectedDayIndex(index)}
                        className={`px-4 py-2 rounded-xl font-medium text-sm whitespace-nowrap transition-colors ${
                          selectedDayIndex === index 
                            ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-900/20' 
                            : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-slate-700/50'
                        }`}
                      >
                        {day.dayName}
                      </button>
                    ))}
                  </div>
                )}

                {/* Content for selected day */}
                {result.dailyResults && result.dailyResults.length > 0 && (() => {
                  const currentDay = result.dailyResults[selectedDayIndex];
                  if (!currentDay) return null;
                  
                  // Extraer todos los spots para el mapa de ESTE día
                  const currentSpots = currentDay.bestSpots?.flatMap((window: any) => window.spots) || [];

                  return (
                    <motion.div
                      key={selectedDayIndex}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                      className="flex flex-col"
                    >
                      {/* Veredicto Albatros */}
                      {currentDay.verdict && (
                        <div className="mb-6 bg-gradient-to-br from-cyan-900/40 to-slate-900 border border-cyan-500/30 rounded-xl p-5 shadow-[0_0_30px_rgba(6,182,212,0.15)]">
                          <h3 className="text-lg font-bold flex items-center gap-2 text-cyan-400 mb-2">
                            <Target size={20} />
                            Veredicto Albatros
                          </h3>
                          <p className="text-slate-100 leading-relaxed font-medium text-base">
                            {currentDay.verdict}
                          </p>
                          {currentDay.waterTemp && (
                            <div className="mt-4 pt-4 border-t border-cyan-500/20 flex flex-wrap gap-4">
                              <div className="flex items-center gap-2 text-sm text-slate-300">
                                <Thermometer size={16} className="text-blue-400" />
                                <span>Agua: <span className="text-blue-300 font-bold">{currentDay.waterTemp}°C</span></span>
                              </div>
                              <div className="flex items-center gap-2 text-sm text-slate-300">
                                <Waves size={16} className="text-cyan-400" />
                                <span>Traje: <span className="text-cyan-300 font-bold">{currentDay.wetsuit}</span></span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Spots List */}
                      <div className="mb-6">
                        <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5 shadow-lg">
                          <h3 className="text-lg font-bold flex items-center gap-2 text-slate-200 mb-4">
                            <MapPin size={20} className="text-cyan-500" />
                            Los points recomendados
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {currentDay.bestSpots?.map((window: any, i: number) => (
                              <div key={i} className="bg-slate-950/30 rounded-xl p-4 border border-slate-800/50">
                                <h4 className="font-bold text-slate-300 mb-3 text-sm uppercase tracking-wider flex items-center gap-2">
                                  <Calendar size={14} className="text-cyan-500" />
                                  {window.timeWindow}
                                </h4>
                                <div className="space-y-3">
                                  {window.spots?.map((spot: any, j: number) => (
                                    <div key={j} className="flex gap-3">
                                      <div className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0 text-[10px] mt-0.5">
                                        {j + 1}
                                      </div>
                                      <div>
                                        <h5 className="font-semibold text-slate-200 text-sm">{spot.name}</h5>
                                        <p className="text-slate-400 text-xs mt-0.5 leading-tight">{spot.description}</p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Map */}
                      {currentSpots.length > 0 && (
                        <div className="h-48 md:h-64 w-full rounded-xl overflow-hidden border border-slate-800 shadow-inner z-0 relative mb-6">
                          <MapContainer
                            key={`map-${selectedDayIndex}-${currentSpots[0].lat}-${currentSpots[0].lng}`}
                            center={[currentSpots[0].lat, currentSpots[0].lng]}
                            zoom={12}
                            scrollWheelZoom={false}
                            style={{ height: '100%', width: '100%', zIndex: 0 }}
                          >
                            <TileLayer
                              attribution='&copy; Esri'
                              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                            />
                            {currentSpots.map((spot: any, index: number) => (
                              <Marker key={`${index}-${spot.lat}-${spot.lng}`} position={[spot.lat, spot.lng]}>
                                <Popup>
                                  <div className="font-sans p-1">
                                    <h3 className="font-bold text-cyan-600 text-sm mb-1">{spot.name}</h3>
                                    <p className="text-xs text-slate-700 m-0 leading-tight">{spot.description}</p>
                                  </div>
                                </Popup>
                              </Marker>
                            ))}
                          </MapContainer>
                        </div>
                      )}

                      {/* Integrated Dashboard (Windguru Style Table) */}
                      {currentDay.forecast && currentDay.forecast.length > 0 && (
                        <div className="bg-slate-950/40 border border-slate-800 rounded-xl overflow-hidden mb-6 shadow-lg">
                          <div className="p-2.5 border-b border-slate-800/50 bg-slate-900/30 flex justify-between items-center">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                              <Activity size={14} className="text-cyan-500" />
                              Estado de las cosas
                            </h3>
                            {result.astronomy && (
                              <div className="flex items-center gap-3 text-[10px] text-slate-500 font-bold uppercase tracking-tighter">
                                <span className="flex items-center gap-1" title="Amanecer"><Sun size={12} className="text-yellow-600"/> {result.astronomy.sunrise}</span>
                                <span className="flex items-center gap-1" title="Atardecer"><Moon size={12} className="text-indigo-500"/> {result.astronomy.sunset}</span>
                              </div>
                            )}
                          </div>
                          
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs text-left whitespace-nowrap font-sans tracking-tight border-collapse">
                              <thead>
                                <tr className="bg-slate-900/30 border-b border-slate-800/50">
                                  <th className="px-2 py-2 font-bold text-slate-500 sticky left-0 bg-slate-900/95 z-10 border-r border-slate-800/50 w-20 uppercase text-[9px] tracking-widest">Hora</th>
                                  {currentDay.forecast.map((f: any, i: number) => (
                                    <th key={i} className={`px-1 py-2 font-bold text-slate-300 text-center border-r border-slate-800/20 last:border-r-0 text-[10px]`}>{f.time}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-800/30">
                                {/* Viento */}
                                <tr className="hover:bg-slate-900/20">
                                  <td className="px-2 py-2 font-medium text-slate-500 sticky left-0 bg-slate-900 z-10 border-r border-slate-800/50 align-middle w-20 text-[10px]">
                                    <div className="flex items-center gap-1.5 h-full">
                                      <Wind size={12} className="text-teal-500" /> Viento
                                    </div>
                                  </td>
                                  {currentDay.forecast.map((f: any, i: number) => (
                                    <td key={i} className={`px-1 py-1.5 text-center align-middle border-r border-slate-800/20 last:border-r-0`}>
                                      <div className="flex flex-col items-center justify-center">
                                        <div className={`inline-flex items-center justify-center gap-1 px-1.5 h-7 rounded-md font-bold w-16 shrink-0 ${getWindColor(f.windSpeed)} text-[11px]`}>
                                          <span>{f.windSpeed}</span>
                                          <ArrowDown size={10} style={{ transform: `rotate(${getDirectionRotation(f.windDirection)}deg)` }} />
                                          <span className="text-[8px] opacity-80">{f.windDirection}</span>
                                        </div>
                                      </div>
                                    </td>
                                  ))}
                                </tr>
                                {/* Olas */}
                                <tr className="hover:bg-slate-900/20">
                                  <td className="px-2 py-2 font-medium text-slate-500 sticky left-0 bg-slate-900 z-10 border-r border-slate-800/50 align-middle w-20 text-[10px]">
                                    <div className="flex items-center gap-1.5 h-full">
                                      <Waves size={12} className="text-blue-500" /> Olas
                                    </div>
                                  </td>
                                  {currentDay.forecast.map((f: any, i: number) => (
                                    <td key={i} className={`px-1 py-1.5 text-center align-middle border-r border-slate-800/20 last:border-r-0`}>
                                      <div className="flex flex-col items-center justify-center">
                                        <div className={`inline-flex items-center justify-center gap-1 px-1.5 h-7 rounded-md font-bold w-16 shrink-0 ${getWaveColor(f.waveHeight)} text-[11px]`}>
                                          <span>{f.waveHeight}</span>
                                          {f.waveDirection && f.waveDirection !== '-' && (
                                            <>
                                              <ArrowDown size={10} style={{ transform: `rotate(${getDirectionRotation(f.waveDirection)}deg)` }} />
                                              <span className="text-[8px] opacity-80">{f.waveDirection}</span>
                                            </>
                                          )}
                                        </div>
                                      </div>
                                    </td>
                                  ))}
                                </tr>
                                {/* Período */}
                                <tr className="hover:bg-slate-900/20">
                                  <td className="px-2 py-2 font-medium text-slate-500 sticky left-0 bg-slate-900 z-10 border-r border-slate-800/50 align-middle w-20 text-[10px]">
                                    <div className="flex items-center gap-1.5 h-full">
                                      <Activity size={12} className="text-indigo-500" /> Período
                                    </div>
                                  </td>
                                  {currentDay.forecast.map((f: any, i: number) => (
                                    <td key={i} className={`px-1 py-1.5 text-center align-middle border-r border-slate-800/20 last:border-r-0`}>
                                      <div className="flex items-center justify-center">
                                        <div className={`inline-flex items-center justify-center px-1.5 h-7 rounded-md font-bold w-16 shrink-0 ${getPeriodColor(f.wavePeriod)} text-[11px]`}>
                                          {f.wavePeriod}s
                                        </div>
                                      </div>
                                    </td>
                                  ))}
                                </tr>
                                {/* Nubosidad */}
                                <tr className="hover:bg-slate-900/20">
                                  <td className="px-2 py-2 font-medium text-slate-500 sticky left-0 bg-slate-900 z-10 border-r border-slate-800/50 align-middle w-20 text-[10px]">
                                    <div className="flex items-center gap-1.5 h-full">
                                      <Cloud size={12} className="text-slate-500" /> Nubes
                                    </div>
                                  </td>
                                  {currentDay.forecast.map((f: any, i: number) => (
                                    <td key={i} className={`px-1 py-1.5 text-center align-middle border-r border-slate-800/20 last:border-r-0`}>
                                      <div className="flex items-center justify-center">
                                        <div className={`inline-flex items-center justify-center px-1.5 h-7 rounded-md font-bold w-16 shrink-0 ${getCloudCoverColor(f.cloudCover)} text-[11px]`}>
                                          {f.cloudCover}%
                                        </div>
                                      </div>
                                    </td>
                                  ))}
                                </tr>
                                {/* Clima */}
                                <tr className="hover:bg-slate-900/20">
                                  <td className="px-2 py-2 font-medium text-slate-500 sticky left-0 bg-slate-900 z-10 border-r border-slate-800/50 align-middle w-20 text-[10px]">
                                    <div className="flex items-center gap-1.5 h-full">
                                      <Thermometer size={12} className="text-orange-500" /> Temp.
                                    </div>
                                  </td>
                                  {currentDay.forecast.map((f: any, i: number) => (
                                    <td key={i} className={`px-1 py-1.5 text-center align-middle border-r border-slate-800/20 last:border-r-0`}>
                                      <div className="flex items-center justify-center">
                                        <div className="inline-flex items-center justify-center px-1.5 h-7 rounded-md font-bold w-16 shrink-0 bg-orange-500/20 text-orange-300 text-[11px]">
                                          {f.temperature}°
                                        </div>
                                      </div>
                                    </td>
                                  ))}
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Disclaimer */}
                      <div className="mb-6 p-3 bg-slate-800/20 border border-slate-700/30 rounded-lg flex items-center gap-3 text-[11px] text-slate-500 leading-tight">
                        <AlertCircle size={14} className="text-yellow-600/50 shrink-0" />
                        <p>
                          <strong className="text-slate-400">Recomendación:</strong> Las condiciones son dinámicas. Volvé a consultar unas horas antes de tu sesión.
                        </p>
                      </div>

                      {/* Spots List */}
                      {/* Veredicto Albatros */}
                      {/* Ad Slot Middle */}
                      <AdSlot className="h-32 w-full mb-8" />

                      {/* Map */}
                      {currentSpots.length > 0 && (
                        <div className="h-64 md:h-80 w-full rounded-xl overflow-hidden border border-slate-800 shadow-inner z-0 relative mb-8">
                          <MapContainer
                            key={`map-${selectedDayIndex}-${currentSpots[0].lat}-${currentSpots[0].lng}`}
                            center={[currentSpots[0].lat, currentSpots[0].lng]}
                            zoom={12}
                            scrollWheelZoom={false}
                            style={{ height: '100%', width: '100%', zIndex: 0 }}
                          >
                            <TileLayer
                              attribution='&copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
                              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                            />
                            {currentSpots.map((spot: any, index: number) => (
                              <Marker key={`${index}-${spot.lat}-${spot.lng}`} position={[spot.lat, spot.lng]}>
                                <Popup>
                                  <div className="font-sans p-1">
                                    <h3 className="font-bold text-cyan-600 text-sm mb-1">{spot.name}</h3>
                                    <p className="text-xs text-slate-700 m-0 leading-tight">{spot.description}</p>
                                  </div>
                                </Popup>
                              </Marker>
                            ))}
                          </MapContainer>
                        </div>
                      )}
                    </motion.div>
                  );
                })()}

                {/* Share Buttons (Bottom) */}
                <div className="relative flex justify-center md:justify-start mb-8" ref={shareRefBottom}>
                  <button
                    onClick={() => setShareOpenBottom(!shareOpenBottom)}
                    className="flex items-center gap-2 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-medium transition-all border border-slate-700 shadow-lg"
                  >
                    <Share2 size={18} />
                    Compartir informe
                    <ChevronDown size={16} className={`transition-transform duration-200 ${shareOpenBottom ? 'rotate-180' : ''}`} />
                  </button>

                  <AnimatePresence>
                    {shareOpenBottom && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute bottom-full mb-2 w-56 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-50 overflow-hidden"
                      >
                        <button
                          onClick={() => {
                            handleShare();
                            setShareOpenBottom(false);
                          }}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-800 transition-colors text-slate-200 text-sm"
                        >
                          {copied ? <Check size={18} className="text-emerald-400" /> : <Copy size={18} className="text-cyan-400" />}
                          <span>{copied ? '¡Copiado!' : 'Copiar Link'}</span>
                        </button>
                        <a
                          href={`https://api.whatsapp.com/send?text=${encodeURIComponent('¡Mirá el reporte de Albatros para mi próxima sesión! 🌊🏄‍♂️\n\n' + window.location.href)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => setShareOpenBottom(false)}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-800 transition-colors text-slate-200 text-sm border-t border-slate-800/50"
                        >
                          <Share2 size={18} className="text-[#25D366]" />
                          <span>WhatsApp</span>
                        </a>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Ad Slot Bottom */}
                <AdSlot className="h-24 w-full mt-auto" />
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="bg-slate-900/30 backdrop-blur-md rounded-2xl border border-slate-800 border-dashed p-8 h-full flex flex-col items-center justify-center lg:justify-start lg:pt-40 text-center text-slate-500 min-h-[400px]"
              >
                <div className="bg-slate-800/50 p-4 rounded-full mb-4 border border-slate-700/50">
                  <Wind size={32} className="text-slate-400" />
                </div>
                <h3 className="text-lg font-medium text-slate-300 mb-2">Esperando parámetros</h3>
                <p className="max-w-sm text-sm text-slate-500">
                  Completá los datos de tu sesión en el panel izquierdo para que Albatros cruce la información meteorológica y te recomiende el spot ideal.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

      </main>
    </div>
  );
}
