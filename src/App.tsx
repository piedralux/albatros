import { useState, useEffect } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import ReactMarkdown from 'react-markdown';
import { MapPin, Calendar, Activity, Car, Target, Waves, Wind, Navigation, Loader2, ChevronDown, ChevronUp, BarChart2, Share2, Check, Copy } from 'lucide-react';
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

const SYSTEM_INSTRUCTION = `Rol: Sos Albatros, un asesor experto en deportes acuáticos (Bodyboard, Surf, Windsurf, SUP, Kitesurf, Náutica, Wave runner, Jet ski, Esquí acuático y Wakeboard). Tu rango de acción abarca CUALQUIER superficie con agua de la República Argentina (costa atlántica, ríos, lagos y lagunas). Considerá que muchas de estas superficies (especialmente en el sur) se congelan o tienen temperaturas extremas en invierno.

Reglas de Análisis (El Protocolo Albatros):
- Morfología del Spot (Prioridad 1): Antes de recomendar, analizá la forma de la costa, río o lago. Evitá bahías cerradas si el swell es pequeño. Buscá escolleras para rebote (Bodyboard) o playas abiertas para fuerza (Surf).
- Cruce Swell/Viento-Dirección: Verificá si la dirección del Swell o Viento entra limpia en la orientación de la playa/costa.
- La Regla del Período (T): T < 7s: Mar movido, "fofo", rinde más para Windsurf si hay viento. T > 9s: Olas con fuerza y rampa. Ideal para Bodyboard.
- Mareas y Corrientes: Consultá siempre el estado de la marea en el mar, o el caudal/corriente en ríos.
- Viento vs. Disciplina: Offshore: Prioridad para Surf/Body. Onshore: Prioridad para Windsurf/Kite si supera los 15 nudos.
- Fuentes de Consulta: Debés basar tus reportes en datos de Windguru (modelos GFS/WRF), Surfline, Windy y tablas locales.
- Tono: Técnico pero cercano. Un lenguaje de "parador de playa" pero con la precisión de un radar náutico.

El output para el usuario debe ser un objeto JSON que contenga:
1. "greeting": Un saludo inicial. DEBE empezar con "¡Aloha, [apodo del deporte]!" (ej: rider, surfer, kiter, remero) seguido de "Te compartimos el análisis para tu sesión de [Deporte] en [Ubicación]."
2. "bestSpots": Un array de objetos agrupados por momento del día. Cada objeto tiene:
   - "timeWindow": Ej: "Sábado (13:30 a 16:30)"
   - "spots": Array de spots recomendados para ese momento, ordenados por calidad. Cada spot tiene "name", "description" (explicación corta del porqué), "lat" y "lng".
3. "radarAnalysis": Un string con el análisis detallado bajo el título "El Radar de Albatros (Análisis de Condiciones)". Utilizá formato Markdown para estructurar la respuesta.
4. "verdict": Un string con el "Veredicto Albatros". Esta es la recomendación final y definitiva, destacando la mejor opción absoluta.
5. "chartData": Un array de datos simulados o reales de las condiciones para graficar. Cada objeto debe tener "time" (ej: "08:00"), "windSpeed" (nudos), "waveHeight" (metros, si aplica, sino 0).`;

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
    d.setDate(d.getDate() + 5);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0];
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!location || !startDate || !startTime || !endDate || !endTime) {
      setError('Por favor, completá la ubicación, fechas y horarios.');
      return;
    }

    const start = new Date(`${startDate}T${startTime}`);
    const end = new Date(`${endDate}T${endTime}`);
    const diffDays = (end.getTime() - start.getTime()) / (1000 * 3600 * 24);
    
    if (diffDays > 5) {
      setError('El rango de fechas no puede superar los 5 días debido a la alta variabilidad de las condiciones.');
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
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              greeting: { type: Type.STRING, description: "El saludo inicial." },
              bestSpots: {
                type: Type.ARRAY,
                description: "Los mejores spots agrupados por franja horaria.",
                items: {
                  type: Type.OBJECT,
                  properties: {
                    timeWindow: { type: Type.STRING, description: "Día y franja horaria, ej: Sábado (13:30 a 16:30)" },
                    spots: {
                      type: Type.ARRAY,
                      description: "Spots recomendados en este horario, ordenados por calidad.",
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          name: { type: Type.STRING },
                          description: { type: Type.STRING },
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
              radarAnalysis: { type: Type.STRING, description: "Análisis detallado en Markdown." },
              verdict: { type: Type.STRING, description: "El Veredicto Albatros: La recomendación final y definitiva." },
              chartData: {
                type: Type.ARRAY,
                description: "Datos para los gráficos de viento y olas.",
                items: {
                  type: Type.OBJECT,
                  properties: {
                    time: { type: Type.STRING },
                    windSpeed: { type: Type.NUMBER },
                    waveHeight: { type: Type.NUMBER }
                  },
                  required: ["time", "windSpeed", "waveHeight"]
                }
              }
            },
            required: ["greeting", "bestSpots", "radarAnalysis", "verdict", "chartData"],
          },
        },
      });

      const jsonStr = response.text || '{}';
      const parsed = JSON.parse(jsonStr);
      setResult(parsed);
      
      // Save successful result to cache
      localStorage.setItem(cacheKey, JSON.stringify(parsed));
    } catch (err: any) {
      console.error(err);
      if (err.message?.includes('429') || err.message?.includes('RESOURCE_EXHAUSTED')) {
        setError('Límite de consultas gratuitas alcanzado. Por favor, esperá un minuto o revisá tu cuota de Gemini API.');
      } else {
        setError('Hubo un error al consultar a Albatros. Por favor, intentá de nuevo.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Extraer todos los spots para el mapa
  const allSpots = result?.bestSpots?.flatMap((window: any) => window.spots) || [];

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
      <section className="relative w-full overflow-hidden border-b border-slate-800">
        {/* Background Video */}
        <div className="absolute inset-0 w-full h-full z-0 bg-slate-900">
          <div 
            className="absolute inset-0 w-full h-full"
            dangerouslySetInnerHTML={{
              __html: `
                <video
                  autoplay
                  loop
                  muted
                  playsinline
                  poster="https://images.unsplash.com/photo-1502680390469-be75c86b636f?q=80&w=2070&auto=format&fit=crop"
                  class="object-cover w-full h-full opacity-80"
                >
                  <source src="/surf-bg.mp4" type="video/mp4" />
                </video>
              `
            }}
          />
          {/* Overlays for readability */}
          <div className="absolute inset-0 bg-slate-950/50"></div>
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent"></div>
        </div>
        
        {/* Content */}
        <div className="relative z-10 max-w-5xl mx-auto px-4 pt-20 pb-16 text-center">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-6 tracking-tight drop-shadow-lg">
            Encontrá tu spot perfecto con Albatros
          </h2>
          <p className="text-cyan-300 font-medium max-w-2xl mx-auto text-lg md:text-xl leading-relaxed mb-4 drop-shadow-md">
            Ingresá tus parámetros y obtené recomendaciones de precisión quirúrgica para tu próxima sesión en el agua
          </p>
          <p className="text-slate-300 max-w-2xl mx-auto text-sm md:text-base leading-relaxed drop-shadow">
            Albatros cruza datos meteorológicos en tiempo real con la geografía de cada spot en Argentina y te da la mejor recomendación para un gran momento acuático.
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
                  <span className="text-xs text-cyan-500 font-medium uppercase tracking-wider block">Hasta (Máx 5 días)</span>
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

                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-8">
                  <h2 className="text-2xl font-bold text-white leading-tight flex-1">
                    {result.greeting}
                  </h2>
                  <button
                    onClick={handleShare}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-medium transition-colors text-sm shrink-0 border border-slate-700"
                  >
                    {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} className="text-cyan-400" />}
                    {copied ? '¡Link copiado!' : 'Copiar Link del Reporte'}
                  </button>
                </div>
                
                {/* Spots List */}
                <div className="space-y-6 mb-8">
                  {result.bestSpots?.map((window: any, i: number) => (
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
                {allSpots.length > 0 && (
                  <div className="h-64 md:h-80 w-full rounded-xl overflow-hidden border border-slate-800 shadow-inner z-0 relative mb-8">
                    <MapContainer
                      key={`${allSpots[0].lat}-${allSpots[0].lng}`}
                      center={[allSpots[0].lat, allSpots[0].lng]}
                      zoom={11}
                      style={{ height: '100%', width: '100%', zIndex: 0 }}
                    >
                      <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                      />
                      {allSpots.map((spot: any, index: number) => (
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
                {result.verdict && (
                  <div className="mb-8 bg-gradient-to-br from-cyan-900/40 to-slate-900 border border-cyan-500/30 rounded-xl p-6 shadow-[0_0_30px_rgba(6,182,212,0.1)]">
                    <h3 className="text-xl font-bold flex items-center gap-2 text-cyan-400 mb-3">
                      <Target size={24} />
                      Veredicto Albatros
                    </h3>
                    <p className="text-slate-200 leading-relaxed font-medium">
                      {result.verdict}
                    </p>
                  </div>
                )}

                {/* Radar Analysis */}
                <div className="mb-8">
                  <h3 className="text-xl font-semibold flex items-center gap-2 text-white border-b border-slate-800 pb-4 mb-4">
                    <Waves className="text-cyan-500" size={24} />
                    El Radar de Albatros (Análisis de Condiciones)
                  </h3>
                  <div className="prose prose-invert prose-cyan max-w-none prose-headings:font-medium prose-h3:text-base prose-p:leading-relaxed prose-p:font-normal prose-p:text-sm md:prose-p:text-base prose-strong:font-medium prose-strong:text-slate-200 prose-a:text-cyan-400 hover:prose-a:text-cyan-300 text-slate-300 font-normal">
                    <ReactMarkdown>{result.radarAnalysis}</ReactMarkdown>
                  </div>
                </div>

                {/* Ad Slot Middle 2 */}
                <AdSlot className="h-24 w-full mb-8" />

                {/* Charts Toggle */}
                {result.chartData && result.chartData.length > 0 && (
                  <div className="border border-slate-800 rounded-xl overflow-hidden mb-8 bg-slate-950/50">
                    <button 
                      onClick={() => setShowCharts(!showCharts)}
                      className="w-full hover:bg-slate-800/50 p-4 flex items-center justify-between transition-colors font-medium text-slate-300"
                    >
                      <div className="flex items-center gap-2">
                        <BarChart2 size={18} className="text-cyan-500" />
                        Gráficos de Viento y Olas
                      </div>
                      {showCharts ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>
                    
                    <AnimatePresence>
                      {showCharts && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="p-6 space-y-8 border-t border-slate-800">
                            {/* Wind Chart */}
                            <div>
                              <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Velocidad del Viento (nudos)</h4>
                              <div className="h-48 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                  <AreaChart data={result.chartData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                                    <defs>
                                      <linearGradient id="colorWind" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                                      </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                                    <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                                    <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#f1f5f9', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.5)' }} />
                                    <Area type="monotone" dataKey="windSpeed" stroke="#06b6d4" strokeWidth={2} fillOpacity={1} fill="url(#colorWind)" />
                                  </AreaChart>
                                </ResponsiveContainer>
                              </div>
                            </div>

                            {/* Wave Chart */}
                            <div>
                              <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Altura de Olas (metros)</h4>
                              <div className="h-48 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                  <AreaChart data={result.chartData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                                    <defs>
                                      <linearGradient id="colorWave" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                      </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                                    <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                                    <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#f1f5f9', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.5)' }} />
                                    <Area type="monotone" dataKey="waveHeight" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorWave)" />
                                  </AreaChart>
                                </ResponsiveContainer>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

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
