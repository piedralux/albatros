import { useState, useEffect } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import ReactMarkdown from 'react-markdown';
import { MapPin, Calendar, Activity, Car, Target, Waves, Wind, Navigation, Loader2, ChevronDown, ChevronUp, BarChart2, Share2, Check, Copy, Thermometer, Droplets, Cloud, CloudRain, Droplet, ArrowRight, Sun, Moon, AlertCircle, ArrowDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

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
            { name: "Playa Grande", description: "Olas consistentes, viento offshore suave.", lat: -38.0267, lng: -57.5316 }
          ]
        }
      ],
      verdict: "Condiciones épicas por la mañana en Playa Grande."
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
            { name: "Waikiki", description: "Reparo del viento sur, ideal para longboard.", lat: -38.0555, lng: -57.5400 }
          ]
        }
      ],
      verdict: "Buscá reparo en Waikiki, el viento sur va a romper el mar abierto."
    }
  ]
};

const SYSTEM_INSTRUCTION = `Rol: Sos Albatros, un asesor experto en deportes acuáticos (Bodyboard, Surf, Windsurf, SUP, Kitesurf, Náutica, Wave runner, Jet ski, Esquí acuático y Wakeboard). Tu rango de acción abarca CUALQUIER superficie con agua de la República Argentina (costa atlántica, ríos, lagos y lagunas). Considerá que muchas de estas superficies (especialmente en el sur) se congelan o tienen temperaturas extremas en invierno.

Reglas de Análisis (El Protocolo Albatros):
- Brevedad (CRÍTICO): Para reducir el tiempo de respuesta, mantén las descripciones muy breves (máximo 15 palabras por spot). No generes texto de relleno.
- Coordenadas Exactas (CRÍTICO): REGLA DE ORO PARA COORDENADAS: LOS PINES DEBEN ESTAR EXACTAMENTE EN LA LÍNEA DE COSTA (la frontera entre la tierra y el agua). NUNCA en medio del mar abierto ni en medio de la ciudad/continente. Los usuarios se quejan de que los pines caen mal. Si recomiendas un spot, busca la latitud y longitud EXACTA de la playa o bajada náutica.
  BASE DE DATOS DE COORDENADAS EXACTAS (ÚSALAS SI RECOMIENDAS ESTOS SPOTS):
  - Mar del Plata (Playa Grande): -38.026, -57.531
  - Mar del Plata (Waikiki/Punta Mogotes): -38.077, -57.543
  - Chapadmalal (Cruz del Sur): -38.180, -57.640
  - Miramar (Punta Hermengo): -38.282, -57.832
  - Necochea (Escollera Sur): -38.580, -58.705
  - Pinamar (Playa Centro): -37.115, -56.855
  - Villa Gesell (Playa Centro): -37.255, -56.965
  - Punta Rasa (San Clemente): -36.290, -56.775
  - San Isidro (Perú Beach / Río de la Plata): -34.475, -58.495
  - Rosario (La Florida / Río Paraná): -32.890, -60.685
  - San Juan (Cuesta del Viento): -30.270, -69.115
  - Mendoza (Potrerillos): -32.950, -69.190
  - Bariloche (Playa Bonita / Nahuel Huapi): -41.115, -71.385
  - Puerto Madryn (Playa Centro): -42.765, -65.030
  - Rada Tilly (Chubut): -45.925, -67.550
  Si el spot no está en esta lista, ASEGÚRATE de que las coordenadas caigan exactamente en la costa, no adentro del agua ni en la ciudad.
- Resultados por Día: DEBES generar un análisis completo (pronóstico, spots y veredicto) para CADA UNO de los días dentro del rango de fechas solicitado.
- Tabla de Pronóstico: Genera un pronóstico detallado por franjas horarias para cada día. OBLIGATORIO: Solo debes generar EXACTAMENTE 2 franjas horarias por día:
  1. Mañana: Desde la hora de amanecer (sunrise) hasta las 13:00. (ej: "Mañana (06:35 - 13:00)")
  2. Tarde: Desde las 13:00 hasta la hora de atardecer (sunset). (ej: "Tarde (13:00 - 19:30)")
- Astronomía: Calcula e incluye la hora estimada de amanecer y atardecer para la ubicación y época del año. Usa estas horas para definir el inicio de la Mañana y el fin de la Tarde.
- Morfología del Spot (Prioridad 1): Antes de recomendar, analizá la forma de la costa, río o lago. Evitá bahías cerradas si el swell es pequeño. Buscá escolleras para rebote (Bodyboard) o playas abiertas para fuerza (Surf).
- Cruce Swell/Viento-Dirección: Verificá si la dirección del Swell o Viento entra limpia en la orientación de la playa/costa.
- La Regla del Período (T): T < 7s: Mar movido, "fofo", rinde más para Windsurf si hay viento. T > 9s: Olas con fuerza y rampa. Ideal para Bodyboard.
- Mareas y Corrientes: Consultá siempre el estado de la marea en el mar, o el caudal/corriente en ríos.
- Viento vs. Disciplina: Offshore: Prioridad para Surf/Body. Onshore: Prioridad para Windsurf/Kite si supera los 15 nudos.
- Fuentes de Consulta: Debés basar tus reportes en datos de Windguru (modelos GFS/WRF), Surfline, Windy y tablas locales.
- Tono: Técnico pero cercano. Un lenguaje de "parador de playa" pero con la precisión de un radar náutico.

El output para el usuario debe ser un objeto JSON que contenga:
1. "greeting": Un saludo inicial. DEBE empezar con "¡Aloha, [apodo del deporte]!" (ej: rider, surfer, kiter, remero) seguido de "Te compartimos el análisis para tu sesión de [Deporte] en [Ubicación]."
2. "astronomy": Un objeto con "sunrise" (ej: "06:30") y "sunset" (ej: "19:45").
3. "dailyResults": Un array de objetos, UNO POR CADA DÍA del rango solicitado. Cada objeto tiene:
   - "date": Fecha (ej: "2026-03-03")
   - "dayName": Nombre del día (ej: "Martes 3")
   - "forecast": Array con el pronóstico por horas de ESE día. Cada objeto debe tener "time" (ej: "Mañana (06:35 - 13:00)"), "windSpeed" (nudos), "windDirection" (ej: "NW"), "waveHeight" (metros, 0 si no aplica), "waveDirection" (ej: "SE"), "wavePeriod" (segundos, 0 si no aplica), "temperature" (°C) y "cloudCover" (porcentaje de nubosidad, de 0 a 100).
   - "bestSpots": Array de spots recomendados para ESE día, agrupados por franja horaria. Cada objeto tiene "timeWindow" y "spots" (máximo 3 spots). Cada spot tiene "name", "description" (explicación MUY corta), "lat" y "lng".
   - "verdict": Veredicto corto para ESE día (máximo 2 oraciones).`;

const AdSlot = ({ className = '' }: { className?: string }) => (
  <div className={`bg-slate-900/50 border border-slate-800 border-dashed flex flex-col items-center justify-center text-slate-500 text-sm p-4 rounded-xl ${className}`}>
    <span className="font-medium text-slate-600 mb-1">Espacio Publicitario</span>
    <span className="text-xs opacity-50">(Google Ads)</span>
  </div>
);

const RadarLoader = () => (
  <div className="flex flex-col items-center justify-center space-y-10">
    <div className="relative w-32 h-32 rounded-full border border-cyan-500/30 bg-slate-900/50 overflow-hidden shadow-[0_0_40px_rgba(6,182,212,0.15)] flex items-center justify-center">
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
      <h3 className="text-xl font-medium text-slate-200">Analizando el radar...</h3>
      <p className="text-sm text-cyan-400/80 animate-pulse">Cruzando datos de viento, mareas y geografía</p>
    </div>
  </div>
);

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

const HERO_IMAGES = [
  "https://images.unsplash.com/photo-1502680390469-be75c86b636f?q=80&w=2070&auto=format&fit=crop", // Surf action
  "https://images.unsplash.com/photo-1537154835319-14f38d108bba?q=80&w=2070&auto=format&fit=crop", // Kitesurf jump
  "https://images.unsplash.com/photo-1530866495561-507c9faab2ed?q=80&w=2000&auto=format&fit=crop", // Windsurf
  "https://images.unsplash.com/photo-1515405295579-ba7b45403062?q=80&w=2000&auto=format&fit=crop", // Surf barrel
  "https://images.unsplash.com/photo-1520208422220-d12a3c588e6c?q=80&w=2000&auto=format&fit=crop"  // Wakeboard
];

const KNOWN_SPOTS: Record<string, {lat: number, lng: number}> = {
  "playa grande": { lat: -38.026, lng: -57.531 },
  "waikiki": { lat: -38.077, lng: -57.543 },
  "punta mogotes": { lat: -38.065, lng: -57.545 },
  "chapadmalal": { lat: -38.180, lng: -57.640 },
  "cruz del sur": { lat: -38.180, lng: -57.640 },
  "miramar": { lat: -38.282, lng: -57.832 },
  "punta hermengo": { lat: -38.282, lng: -57.832 },
  "necochea": { lat: -38.580, lng: -58.705 },
  "escollera sur": { lat: -38.580, lng: -58.705 },
  "pinamar": { lat: -37.115, lng: -56.855 },
  "villa gesell": { lat: -37.255, lng: -56.965 },
  "punta rasa": { lat: -36.290, lng: -56.775 },
  "san clemente": { lat: -36.290, lng: -56.775 },
  "perú beach": { lat: -34.475, lng: -58.495 },
  "peru beach": { lat: -34.475, lng: -58.495 },
  "san isidro": { lat: -34.475, lng: -58.495 },
  "la florida": { lat: -32.890, lng: -60.685 },
  "rosario": { lat: -32.890, lng: -60.685 },
  "cuesta del viento": { lat: -30.270, lng: -69.115 },
  "potrerillos": { lat: -32.950, lng: -69.190 },
  "playa bonita": { lat: -41.115, lng: -71.385 },
  "nahuel huapi": { lat: -41.115, lng: -71.385 },
  "puerto madryn": { lat: -42.765, lng: -65.030 },
  "rada tilly": { lat: -45.925, lng: -67.550 },
};

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
  const [error, setError] = useState('');
  const [showCharts, setShowCharts] = useState(false);
  const [copied, setCopied] = useState(false);
  const [progress, setProgress] = useState(0);
  const [hasAutoSubmitted, setHasAutoSubmitted] = useState(false);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [heroImage, setHeroImage] = useState(HERO_IMAGES[0]);

  useEffect(() => {
    setHeroImage(HERO_IMAGES[Math.floor(Math.random() * HERO_IMAGES.length)]);
  }, []);

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
          return prev + Math.random() * 15;
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
    if (!location || !startDate || !startTime || !endDate || !endTime) {
      setError('Por favor, completá la ubicación, fechas y horarios.');
      return;
    }

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
    const cachedResult = localStorage.getItem(cacheKey);

    if (cachedResult) {
      try {
        console.log("Cargando desde caché para ahorrar cuota de API...");
        setResult(JSON.parse(cachedResult));
        setLoading(false);
        return;
      } catch (e) {
        // If cache is invalid, ignore and fetch again
        localStorage.removeItem(cacheKey);
      }
    }

    const prompt = `
📍 Ubicación: ${location}
📅 Fecha y Franja Horaria: Desde ${start.toLocaleString('es-AR')} hasta ${end.toLocaleString('es-AR')}
🏄 Deporte: ${sport}
🚗 Movilidad: Hasta ${mobility}km
🎯 Objetivo: ${objective || 'No especificado'}
`;

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === 'undefined') {
        setError('Falta configurar la clave GEMINI_API_KEY en Vercel. Entrá a la configuración de tu proyecto en Vercel > Settings > Environment Variables y agregala.');
        setLoading(false);
        return;
      }

      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          temperature: 0, // Deterministic output for consistent forecasts
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
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
                      description: "Pronóstico detallado por horas para este día. OBLIGATORIO: EXACTAMENTE 2 franjas horarias (Mañana y Tarde).",
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
                              },
                              required: ["name", "description", "lat", "lng"]
                            }
                          }
                        },
                        required: ["timeWindow", "spots"]
                      }
                    },
                    verdict: { type: Type.STRING, description: "Veredicto corto para este día." }
                  },
                  required: ["date", "dayName", "forecast", "bestSpots", "verdict"]
                }
              }
            },
            required: ["greeting", "astronomy", "dailyResults"],
          },
        },
      });

      const jsonStr = response.text || '{}';
      const parsed = JSON.parse(jsonStr);
      
      // Post-process to snap coordinates to known spots
      if (parsed.dailyResults) {
        parsed.dailyResults.forEach((day: any) => {
          if (day.bestSpots) {
            day.bestSpots.forEach((window: any) => {
              if (window.spots) {
                window.spots.forEach((spot: any) => {
                  const spotNameLower = spot.name.toLowerCase();
                  for (const [knownName, coords] of Object.entries(KNOWN_SPOTS)) {
                    if (spotNameLower.includes(knownName)) {
                      spot.lat = coords.lat;
                      spot.lng = coords.lng;
                      break;
                    }
                  }
                });
              }
            });
          }
        });
      }

      setResult(parsed);
      
      // Save successful result to cache
      localStorage.setItem(cacheKey, JSON.stringify(parsed));
    } catch (err: any) {
      console.error(err);
      if (err.message?.includes('429') || err.message?.includes('RESOURCE_EXHAUSTED')) {
        console.warn("Rate limit hit. Using mock data.");
        setResult(MOCK_RESULT);
        setError('⚠️ Límite de consultas gratuitas de Google alcanzado. Te mostramos un reporte de demostración para que veas cómo funciona.');
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
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-cyan-900 selection:text-cyan-50">
      {/* Header */}
      <header className="bg-slate-950/80 backdrop-blur-md border-b border-slate-800 text-white py-4 px-4 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto flex items-center justify-center gap-3">
          <div className="bg-cyan-500/10 p-2.5 rounded-xl text-cyan-400 border border-cyan-500/20">
            <Waves size={24} strokeWidth={2.5} />
          </div>
          <div className="flex flex-col items-center">
            <h1 className="text-2xl font-bold tracking-tight text-white leading-none">Albatros</h1>
            <p className="text-slate-400 text-[10px] font-medium uppercase tracking-widest mt-1">Radar Acuático</p>
          </div>
        </div>
      </header>

      {/* Intro Text with Video Background */}
      <section className="relative w-full overflow-hidden border-b border-slate-800 h-[500px] flex items-center justify-center">
        {/* Background Image */}
        <div className="absolute inset-0 w-full h-full z-0 bg-slate-900 overflow-hidden">
          <div 
            className="absolute inset-0 w-full h-full bg-cover bg-center animate-kenburns will-change-transform"
            style={{ backgroundImage: `url('${heroImage}')` }}
          />
          {/* Overlays for readability (less dark, full color) */}
          <div className="absolute inset-0 bg-slate-950/40"></div>
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent"></div>
        </div>
        
        {/* Content */}
        <div className="relative z-10 max-w-5xl mx-auto px-4 text-center mt-10">
          <h2 className="text-4xl md:text-6xl font-bold text-white mb-6 tracking-tight drop-shadow-lg">
            Pronóstico Inteligente para <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">Deportes Acuáticos</span>
          </h2>
          <p className="text-slate-200 max-w-2xl mx-auto text-lg md:text-xl leading-relaxed drop-shadow-md font-medium">
            Contanos dónde estás, qué deporte hacés y hasta dónde te podés mover. Nosotros cruzamos los datos y te tiramos la posta del mejor spot.
          </p>
        </div>
      </section>

      {/* Top Ad Slots */}
      <div className="max-w-5xl mx-auto px-4 py-2 grid grid-cols-1 md:grid-cols-2 gap-4">
        <AdSlot className="h-24 w-full" />
        <AdSlot className="h-24 w-full hidden md:flex" />
      </div>

      <main className="max-w-5xl mx-auto p-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Form Section */}
        <section className="lg:col-span-5 bg-slate-900 rounded-2xl shadow-xl border border-slate-800 p-6 flex flex-col gap-6">
          <h2 className="text-xl font-semibold flex items-center gap-2 text-white">
            <Navigation className="text-cyan-500" size={20} />
            Configurá tu sesión
          </h2>
          
          <form onSubmit={handleSubmit} className="space-y-5">
            
            {/* Ubicación */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <MapPin size={16} className="text-slate-500" />
                Ubicación (Mar, Río, Lago o Laguna)
              </label>
              <input
                type="text"
                placeholder="Ej: Mar del Plata / Río de la Plata / Nahuel Huapi"
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
                <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800 space-y-2">
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
                <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800 space-y-2">
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
                <option value="Náutica">Náutica</option>
                <option value="Wave runner">Wave runner</option>
                <option value="Jet ski">Jet ski</option>
                <option value="Esquí acuático">Esquí acuático</option>
                <option value="Wakeboard">Wakeboard</option>
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
              disabled={loading}
              className="relative w-full bg-cyan-600 hover:bg-cyan-500 text-white font-medium py-3 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:cursor-not-allowed shadow-lg shadow-cyan-900/20 overflow-hidden"
            >
              {loading && (
                <div 
                  className="absolute left-0 top-0 bottom-0 bg-cyan-400/30 transition-all duration-500 ease-out"
                  style={{ width: `${progress}%` }}
                />
              )}
              <div className="relative z-10 flex items-center gap-2">
                {loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>Analizando... {Math.round(progress)}%</span>
                  </>
                ) : (
                  <>
                    <Wind size={18} />
                    <span>Consultar a Albatros</span>
                  </>
                )}
              </div>
            </button>
          </form>

          {/* Ad Slot Sidebar */}
          <AdSlot className="flex-1 min-h-[200px] w-full mt-4" />
        </section>

        {/* Results Section */}
        <section className="lg:col-span-7">
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-slate-900/50 rounded-2xl border border-slate-800 border-dashed p-8 h-full flex flex-col items-center justify-center text-center min-h-[400px]"
              >
                <RadarLoader />
              </motion.div>
            ) : result ? (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-slate-900 rounded-2xl shadow-xl border border-slate-800 p-6 md:p-8 h-full flex flex-col"
              >
                {/* Ad Slot Top */}
                <AdSlot className="h-24 w-full mb-6" />

                <div className="mb-6">
                  <h2 className="text-xl md:text-2xl font-medium text-slate-100 leading-tight w-full text-center md:text-left">
                    {result.greeting}
                  </h2>
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
                      {/* Integrated Dashboard (Windguru Style Table) */}
                      {currentDay.forecast && currentDay.forecast.length > 0 && (
                        <div className="bg-slate-950/40 border border-slate-800 rounded-xl overflow-hidden mb-6 shadow-lg">
                          <div className="p-2.5 border-b border-slate-800/50 bg-slate-900/50 flex justify-between items-center">
                            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                              <Activity size={14} className="text-cyan-500" />
                              Pronóstico Detallado
                            </h3>
                            {result.astronomy && (
                              <div className="flex items-center gap-3 text-[10px] md:text-xs text-slate-400 font-medium">
                                <span className="flex items-center gap-1" title="Amanecer"><Sun size={12} className="text-yellow-500"/> {result.astronomy.sunrise}</span>
                                <span className="flex items-center gap-1" title="Atardecer"><Moon size={12} className="text-indigo-400"/> {result.astronomy.sunset}</span>
                              </div>
                            )}
                          </div>
                          
                          <div className="overflow-x-auto">
                            <table className="w-full text-[11px] md:text-xs text-left whitespace-nowrap font-sans tracking-tight">
                              <thead>
                                <tr className="bg-slate-900/30 border-b border-slate-800/50">
                                  <th className="px-3 py-2 font-medium text-slate-400 sticky left-0 bg-slate-900/90 z-10 border-r border-slate-800/50">Hora</th>
                                  {currentDay.forecast.map((f: any, i: number) => (
                                    <th key={i} className={`px-2 py-2 font-medium text-slate-200 text-center`}>{f.time}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-800/50">
                                {/* Viento */}
                                <tr className="hover:bg-slate-900/20">
                                  <td className="px-3 py-2 font-normal text-slate-400 sticky left-0 bg-slate-900 z-10 border-r border-slate-800/50 align-middle">
                                    <div className="flex items-center gap-1.5 h-full">
                                      <Wind size={12} className="text-teal-400" /> Viento (kts)
                                    </div>
                                  </td>
                                  {currentDay.forecast.map((f: any, i: number) => (
                                    <td key={i} className={`px-1 py-1.5 text-center align-middle`}>
                                      <div className="flex items-center justify-center gap-2">
                                        <div className={`inline-flex items-center justify-center w-12 h-6 rounded font-medium ${getWindColor(f.windSpeed)}`}>
                                          {f.windSpeed}
                                        </div>
                                        <div className="flex items-center gap-1 text-slate-300 font-medium w-12 justify-start">
                                          <ArrowDown size={12} style={{ transform: `rotate(${getDirectionRotation(f.windDirection)}deg)` }} />
                                          <span>{f.windDirection}</span>
                                        </div>
                                      </div>
                                    </td>
                                  ))}
                                </tr>
                                {/* Olas */}
                                <tr className="hover:bg-slate-900/20">
                                  <td className="px-3 py-2 font-normal text-slate-400 sticky left-0 bg-slate-900 z-10 border-r border-slate-800/50 align-middle">
                                    <div className="flex items-center gap-1.5 h-full">
                                      <Waves size={12} className="text-blue-400" /> Olas (m)
                                    </div>
                                  </td>
                                  {currentDay.forecast.map((f: any, i: number) => (
                                    <td key={i} className={`px-1 py-1.5 text-center align-middle`}>
                                      <div className="flex items-center justify-center gap-2">
                                        <div className={`inline-flex items-center justify-center w-12 h-6 rounded font-medium ${getWaveColor(f.waveHeight)}`}>
                                          {f.waveHeight}
                                        </div>
                                        <div className="flex items-center gap-1 text-slate-300 font-medium w-12 justify-start">
                                          {f.waveDirection && f.waveDirection !== '-' ? (
                                            <>
                                              <ArrowDown size={12} style={{ transform: `rotate(${getDirectionRotation(f.waveDirection)}deg)` }} />
                                              <span>{f.waveDirection}</span>
                                            </>
                                          ) : (
                                            <span className="opacity-50">-</span>
                                          )}
                                        </div>
                                      </div>
                                    </td>
                                  ))}
                                </tr>
                                {/* Período */}
                                <tr className="hover:bg-slate-900/20">
                                  <td className="px-3 py-2 font-normal text-slate-400 sticky left-0 bg-slate-900 z-10 border-r border-slate-800/50 align-middle">
                                    <div className="flex items-center gap-1.5 h-full">
                                      <Activity size={12} className="text-indigo-400" /> Período (s)
                                    </div>
                                  </td>
                                  {currentDay.forecast.map((f: any, i: number) => (
                                    <td key={i} className={`px-1 py-1.5 text-center align-middle`}>
                                      <div className="flex items-center justify-center gap-2">
                                        <div className={`inline-flex items-center justify-center w-12 h-6 rounded font-medium ${getPeriodColor(f.wavePeriod)}`}>
                                          {f.wavePeriod}
                                        </div>
                                        <div className="w-12"></div>
                                      </div>
                                    </td>
                                  ))}
                                </tr>
                                {/* Nubosidad */}
                                <tr className="hover:bg-slate-900/20">
                                  <td className="px-3 py-2 font-normal text-slate-400 sticky left-0 bg-slate-900 z-10 border-r border-slate-800/50 align-middle">
                                    <div className="flex items-center gap-1.5 h-full">
                                      <Cloud size={12} className="text-slate-400" /> Nubosidad (%)
                                    </div>
                                  </td>
                                  {currentDay.forecast.map((f: any, i: number) => (
                                    <td key={i} className={`px-1 py-1.5 text-center align-middle`}>
                                      <div className="flex items-center justify-center gap-2">
                                        <div className={`inline-flex items-center justify-center w-12 h-6 rounded font-medium ${getCloudCoverColor(f.cloudCover)}`}>
                                          {f.cloudCover}
                                        </div>
                                        <div className="w-12"></div>
                                      </div>
                                    </td>
                                  ))}
                                </tr>
                                {/* Clima */}
                                <tr className="hover:bg-slate-900/20">
                                  <td className="px-3 py-2 font-normal text-slate-400 sticky left-0 bg-slate-900 z-10 border-r border-slate-800/50 align-middle">
                                    <div className="flex items-center gap-1.5 h-full">
                                      <Thermometer size={12} className="text-orange-400" /> Temp. (°C)
                                    </div>
                                  </td>
                                  {currentDay.forecast.map((f: any, i: number) => (
                                    <td key={i} className={`px-1 py-1.5 text-center align-middle`}>
                                      <div className="flex items-center justify-center gap-2">
                                        <div className="inline-flex items-center justify-center w-12 h-6 rounded font-medium bg-orange-500/20 text-orange-300">
                                          {f.temperature}°
                                        </div>
                                        <div className="w-12"></div>
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
                      <div className="mb-6 p-3 bg-slate-800/30 border border-slate-700/50 rounded-lg flex items-start gap-2 text-xs text-slate-400">
                        <AlertCircle size={14} className="text-yellow-500/70 shrink-0 mt-0.5" />
                        <p>
                          <strong className="text-slate-300">Aviso:</strong> Las condiciones meteorológicas son dinámicas y pueden variar. 
                          Te sugerimos volver a consultar a Albatros unas horas antes de tu sesión para obtener el pronóstico más actualizado.
                        </p>
                      </div>

                      {/* Share Buttons (Between Dashboard and Report) */}
                      <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mb-8">
                        <button
                          onClick={handleShare}
                          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-medium transition-colors text-sm border border-slate-700"
                        >
                          {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} className="text-cyan-400" />}
                          {copied ? '¡Copiado!' : 'Copiar Link'}
                        </button>
                        <a
                          href={`https://api.whatsapp.com/send?text=${encodeURIComponent('¡Mirá el reporte de Albatros para mi próxima sesión! 🌊🏄‍♂️\n\n' + window.location.href)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-4 py-2 bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] rounded-lg font-medium transition-colors text-sm border border-[#25D366]/20"
                        >
                          <Share2 size={16} />
                          WhatsApp
                        </a>
                      </div>
                      
                      {/* Spots List */}
                      <div className="space-y-6 mb-8">
                        {currentDay.bestSpots?.map((window: any, i: number) => (
                          <div key={i} className="bg-slate-950/50 rounded-xl p-5 border border-slate-800">
                            <h3 className="font-bold text-slate-200 mb-4 text-lg border-b border-slate-800 pb-2 flex items-center gap-2">
                              <Calendar size={18} className="text-cyan-500" />
                              {window.timeWindow}
                            </h3>
                            <div className="space-y-4">
                              {window.spots?.map((spot: any, j: number) => (
                                <div key={j} className="flex gap-3">
                                  <div className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-bold rounded-full w-6 h-6 flex items-center justify-center shrink-0 text-sm mt-0.5">
                                    {j + 1}
                                  </div>
                                  <div>
                                    <h4 className="font-semibold text-slate-200">{spot.name}</h4>
                                    <p className="text-slate-400 text-sm mt-1">{spot.description}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Map */}
                      {currentSpots.length > 0 && (
                        <div className="h-64 md:h-80 w-full rounded-xl overflow-hidden border border-slate-800 shadow-inner z-0 relative mb-8">
                          <MapContainer
                            key={`${currentSpots[0].lat}-${currentSpots[0].lng}`}
                            center={[currentSpots[0].lat, currentSpots[0].lng]}
                            zoom={11}
                            style={{ height: '100%', width: '100%', zIndex: 0 }}
                          >
                            <TileLayer
                              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                            />
                            {currentSpots.map((spot: any, index: number) => (
                              <Marker key={index} position={[spot.lat, spot.lng]}>
                                <Popup>
                                  <div className="font-sans">
                                    <h3 className="font-bold text-cyan-700 text-sm mb-1">{spot.name}</h3>
                                    <p className="text-xs text-slate-600 m-0 leading-tight">{spot.description}</p>
                                  </div>
                                </Popup>
                              </Marker>
                            ))}
                          </MapContainer>
                        </div>
                      )}

                      {/* Ad Slot Middle */}
                      <AdSlot className="h-32 w-full mb-8" />

                      {/* Veredicto Albatros */}
                      {currentDay.verdict && (
                        <div className="mb-8 bg-gradient-to-br from-cyan-900/40 to-slate-900 border border-cyan-500/30 rounded-xl p-6 shadow-[0_0_30px_rgba(6,182,212,0.1)]">
                          <h3 className="text-xl font-bold flex items-center gap-2 text-cyan-400 mb-3">
                            <Target size={24} />
                            Veredicto Albatros
                          </h3>
                          <p className="text-slate-200 leading-relaxed font-medium">
                            {currentDay.verdict}
                          </p>
                        </div>
                      )}
                    </motion.div>
                  );
                })()}

                {/* Share Buttons (Bottom) */}
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mb-8">
                  <button
                    onClick={handleShare}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-medium transition-colors text-sm border border-slate-700"
                  >
                    {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} className="text-cyan-400" />}
                    {copied ? '¡Copiado!' : 'Copiar Link'}
                  </button>
                  <a
                    href={`https://api.whatsapp.com/send?text=${encodeURIComponent('¡Mirá el reporte de Albatros para mi próxima sesión! 🌊🏄‍♂️\n\n' + window.location.href)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] rounded-lg font-medium transition-colors text-sm border border-[#25D366]/20"
                  >
                    <Share2 size={16} />
                    WhatsApp
                  </a>
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
                className="bg-slate-900/50 rounded-2xl border border-slate-800 border-dashed p-8 h-full flex flex-col items-center justify-center text-center text-slate-500 min-h-[400px]"
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
