import React, { useEffect, useState } from "react";
import {
  Thermometer,
  Droplets,
  RefreshCw,
  Wifi,
  WifiOff,
  AlertTriangle,
  LogOut,
} from "lucide-react";
import { io } from "socket.io-client";
import { useReadings } from "../hooks/useReadings";
import { useAuth } from "../context/AuthContext";
import axios from "axios";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import RGBController from "../components/RGBController";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleString("es-ES");

const temperatureColor = (t: number) => {
  if (t < 18) return "text-sky-600";
  if (t < 27) return "text-emerald-600";
  if (t < 30) return "text-amber-600";
  return "text-rose-600";
};
const humidityColor = (h: number) => {
  if (h < 30) return "text-amber-600";
  if (h <= 60) return "text-emerald-600";
  return "text-sky-600";
};
const temperatureGradient = (t: number) => {
  if (t < 18) return "from-sky-500 via-sky-600 to-indigo-600";
  if (t < 27) return "from-emerald-500 via-emerald-600 to-teal-600";
  if (t < 30) return "from-amber-500 via-orange-500 to-amber-600";
  return "from-rose-500 via-red-500 to-orange-600";
};
const humidityGradient = (h: number) => {
  if (h < 30) return "from-amber-400 via-amber-500 to-orange-500";
  if (h <= 60) return "from-emerald-500 via-green-500 to-teal-500";
  return "from-sky-500 via-blue-500 to-indigo-500";
};

const Dashboard: React.FC = () => {
  const {
    readings,
    latestReading,
    pagination,
    loading,
    error,
    stats,
    fetchPage,
    refreshLatest,
    setLatestReading,
    setPage,
  } = useReadings({ apiUrl: API_URL });
  const { logout, user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [socketError, setSocketError] = useState<string | null>(null);
  const [chartData, setChartData] = useState<any>(null);
  const [daysRange, setDaysRange] = useState(3);
  const [actuators, setActuators] = useState<any>(null);
  const [rgbLoading, setRgbLoading] = useState(false);
  const [currentRGBColor, setCurrentRGBColor] = useState("#000000");
  // Acciones de actuadores
  const [actions, setActions] = useState<any[]>([]);
  const [actionsPage, setActionsPage] = useState(1);
  const [actionsPages, setActionsPages] = useState(1);
  const [actionsTotal, setActionsTotal] = useState(0);
  const [actionsLimit] = useState(10);
  const [actionsLoading, setActionsLoading] = useState(false);
  //servo

  // ...ex
  const controlRGBLED = async (colorData: any) => {
    setRgbLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/actuators/light/rgb`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          room: "default",
          ...colorData,
        }),
      });

      if (!response.ok) {
        throw new Error("Error controlando LED RGB");
      }

      const result = await response.json();
      console.log("RGB LED controlado:", result);

      if (colorData.hex) {
        setCurrentRGBColor(colorData.hex);
      } else if (colorData.rgb) {
        const { r, g, b } = colorData.rgb;
        const hex = `#${r.toString(16).padStart(2, "0")}${g
          .toString(16)
          .padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
        setCurrentRGBColor(hex);
      } else if (colorData.color === "off") {
        setCurrentRGBColor("#000000");
      }

      refreshLatest();
    } catch (error) {
      console.error("Error:", error);
      alert("Error controlando LED RGB");
    } finally {
      setRgbLoading(false);
    }
  };

  // Socket
  useEffect(() => {
    const socket = io(API_URL);
    socket.on("connect", () => {
      setIsConnected(true);
      setSocketError(null);
    });
    socket.on("disconnect", () => setIsConnected(false));
    socket.on("connect_error", (e: any) =>
      setSocketError(e?.message ?? "error")
    );
    socket.on("newReading", (data: any) => {
      refreshLatest();
      if ((pagination?.page ?? 1) === 1) fetchPage(1);
    });
    // Escuchar actualizaciones de sensores para refrescar acciones cuando el tipo sea de actuador
    socket.on("sensor_update", (payload: any) => {
      if (!payload?.type) return;
      if (["temperature", "humidity", "soil"].includes(payload.type)) {
        // lecturas ambientales existentes
        return;
      }
      // recargar acciones para reflejar nueva actividad
      loadActions(actionsPage);
    });
    return () => {
      socket.disconnect();
    };
  }, [fetchPage, pagination?.page, setLatestReading]);

  const loadActions = async (page = 1) => {
    try {
      setActionsLoading(true);
      const res = await axios.get(`${API_URL}/api/actuators/actions`, {
        params: { page, limit: actionsLimit },
      });
      setActions(res.data?.data || []);
      setActionsPage(res.data?.page || 1);
      setActionsPages(res.data?.pages || 1);
      setActionsTotal(res.data?.total || 0);
    } catch (e) {
      console.error("Error cargando acciones", e);
    } finally {
      setActionsLoading(false);
    }
  };

  useEffect(() => {
    loadActions(1);
  }, []);

  useEffect(() => {
    const loadChart = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/sensors/chart`, {
          params: { type: "temperature", days: daysRange },
        });
        const data = res.data || [];
        const labels = data.map((d: any) => d.date);
        const values = data.map((d: any) => d.value);
        setChartData({
          labels,
          datasets: [
            {
              label: "Temperatura (°C)",
              data: values,
              borderColor: "#ef4444",
              backgroundColor: "rgba(239,68,68,0.2)",
            },
          ],
        });
      } catch (err) {
        setChartData(null);
      }
    };
    loadChart();
  }, [daysRange]);

  const loadActuators = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/actuators/status`);
      setActuators(res.data);
    } catch (e) {
      console.error("Error cargando actuadores", e);
      setActuators(null);
    }
  };

  useEffect(() => {
    loadActuators();
  }, []);

  const setLight = async (
    room: string,
    state: "on" | "off",
    color?: string
  ) => {
    try {
      await axios.post(`${API_URL}/api/actuators/light`, {
        room,
        state,
        color,
      });
      await loadActuators();
    } catch (e) {
      console.error("Error controlando luz", e);
    }
  };

  const operateServo = async (angle?: number, position?: string) => {
    try {
      const payload: any = {};
      if (typeof angle !== "undefined") payload.angle = angle;
      if (typeof position !== "undefined") payload.position = position;
      await axios.post(`${API_URL}/api/actuators/servo`, payload);
      await loadActuators();
    } catch (e) {
      console.error("Error controlando servo", e);
    }
  };

  const operatePump = async (state: boolean) => {
    try {
      const humidity = (latestReading as any)?.humidity ?? null;
      await axios.post(`${API_URL}/api/actuators/pump`, { state, humidity });
      await loadActuators();
    } catch (e) {
      console.error("Error controlando bomba", e);
    }
  };

  const operateFan = async (state: boolean) => {
    try {
      await axios.post(`${API_URL}/api/actuators/fan`, { fan: state ? "on" : "off" });
      await loadActuators();
    } catch (e) {
      console.error("Error controlando ventilador", e);
    }
  };

  const tempStats = stats?.temp ?? null;
  const humStats = stats?.hum ?? null;

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 md:px-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col gap-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-800">
                Dashboard Smart Home
              </h1>
              <p className="text-slate-500 text-sm">
                Monitoreo integrado — Pinos Altos
              </p>
            </div>
            <div className="flex items-center gap-3">
              {isConnected ? (
                <span className="inline-flex items-center gap-2 text-sm font-medium text-green-600 bg-green-50 border border-green-200 px-3 py-1.5 rounded-full">
                  <Wifi className="size-4" /> Conectado
                </span>
              ) : (
                <span className="inline-flex items-center gap-2 text-sm font-medium text-rose-600 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-full">
                  <WifiOff className="size-4" /> Desconectado
                </span>
              )}
              <div className="h-9 w-px bg-slate-200" />
              <div className="flex items-center gap-2">
                <div className="text-sm text-slate-600">
                  {user?.displayName ?? user?.username}
                </div>
                <button
                  onClick={logout}
                  title="Cerrar sesión"
                  className="inline-flex items-center gap-2 px-3 py-1 rounded bg-slate-800 text-white"
                >
                  <LogOut className="size-4" />
                  Salir
                </button>
              </div>
            </div>
          </div>
        </div>

        {(error || socketError) && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 flex gap-3 text-amber-800 text-sm">
            <AlertTriangle className="size-5 shrink-0" />
            <div>
              <p className="font-medium mb-1">Problema de conexión</p>
              {error && <p>API: {String(error)}</p>}
              {socketError && <p>Socket: {socketError}</p>}
              <button
                onClick={() => {
                  fetchPage(pagination?.page ?? 1);
                  refreshLatest();
                }}
                className="mt-2 inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md bg-amber-600 text-white hover:bg-amber-500"
              >
                Reintentar
              </button>
            </div>
          </div>
        )}

        {/* Sensor Cards */}
        {latestReading && (
          <div className="grid gap-6 md:grid-cols-2">
            <div
              className={`group relative bg-gradient-to-br ${temperatureGradient(
                (latestReading as any).temperature ?? 0
              )} text-white rounded-3xl p-6 w-full overflow-hidden shadow-md`}
            >
              <div className="flex items-center gap-4">
                <div className="bg-white/20 rounded-2xl p-4 backdrop-blur-sm">
                  <Thermometer className="size-8" />
                </div>
                <div>
                  <div className="text-sm uppercase tracking-wide font-medium text-white/80">
                    Temperatura Actual
                  </div>
                  <div className="text-5xl font-bold leading-none drop-shadow-sm">
                    {(latestReading as any)?.temperature ?? "—"}
                    {(latestReading as any)?.tempUnit
                      ? ` ${(latestReading as any).tempUnit}`
                      : " °C"}
                  </div>
                </div>
              </div>
              <div className="mt-4 text-xs text-white/70">
                Última actualización:{" "}
                {formatDate((latestReading as any).timestamp)}
              </div>
              {tempStats && (
                <div className="mt-5 grid grid-cols-3 gap-3 text-center text-xs">
                  <div className="bg-white/15 rounded-lg py-2">
                    <div className="font-semibold">{tempStats.min}°C</div>
                    <div className="opacity-70">Mín</div>
                  </div>
                  <div className="bg-white/15 rounded-lg py-2">
                    <div className="font-semibold">{tempStats.avg}°C</div>
                    <div className="opacity-70">Prom</div>
                  </div>
                  <div className="bg-white/15 rounded-lg py-2">
                    <div className="font-semibold">{tempStats.max}°C</div>
                    <div className="opacity-70">Máx</div>
                  </div>
                </div>
              )}
            </div>

            <div
              className={`group relative bg-gradient-to-br ${humidityGradient(
                (latestReading as any).humidity ?? 0
              )} text-white rounded-3xl p-6 w-full overflow-hidden shadow-md`}
            >
              <div className="flex items-center gap-4">
                <div className="bg-white/20 rounded-2xl p-4 backdrop-blur-sm">
                  <Droplets className="size-8" />
                </div>
                <div>
                  <div className="text-sm uppercase tracking-wide font-medium text-white/80">
                    Humedad Actual
                  </div>
                  <div className="text-5xl font-bold leading-none drop-shadow-sm">
                    {(latestReading as any)?.humidity ?? "—"}
                    {(latestReading as any)?.humUnit
                      ? ` ${(latestReading as any).humUnit}`
                      : " %"}
                  </div>
                </div>
              </div>
              <div className="mt-4 text-xs text-white/70">
                Última actualización:{" "}
                {formatDate((latestReading as any).timestamp)}
              </div>
              {humStats && (
                <div className="mt-5 grid grid-cols-3 gap-3 text-center text-xs">
                  <div className="bg-white/15 rounded-lg py-2">
                    <div className="font-semibold">{humStats.min}%</div>
                    <div className="opacity-70">Mín</div>
                  </div>
                  <div className="bg-white/15 rounded-lg py-2">
                    <div className="font-semibold">{humStats.avg}%</div>
                    <div className="opacity-70">Prom</div>
                  </div>
                  <div className="bg-white/15 rounded-lg py-2">
                    <div className="font-semibold">{humStats.max}%</div>
                    <div className="opacity-70">Máx</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Charts + controls */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-800">Gráficas</h2>
            <div className="flex items-center gap-2">
              <select
                value={daysRange}
                onChange={(e) => setDaysRange(Number(e.target.value))}
                className="border px-2 py-1 rounded"
              >
                <option value={1}>1 día</option>
                <option value={3}>3 días</option>
                <option value={7}>7 días</option>
              </select>
            </div>
          </div>
          <div>
            {chartData ? (
              <Line data={chartData} />
            ) : (
              <div className="text-sm text-slate-500">
                No hay datos de gráfica disponibles.
              </div>
            )}
          </div>
        </div>

        {/* Actuadores */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Control RGB LED */}
          <RGBController
            onColorChange={controlRGBLED}
            currentColor={currentRGBColor}
            isLoading={rgbLoading}
          />

          {/* Otros Actuadores */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-800">
                Control de Actuadores
              </h2>
              <button
                onClick={loadActuators}
                className="text-sm px-3 py-1 rounded border"
              >
                Refrescar estado
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div className="p-4 border rounded">
                <h3 className="font-medium mb-2">Iluminación por Habitación</h3>
                <div className="space-y-3">
                  {[
                    { key: "sala", name: "Sala", icon: "🛋️" },
                    { key: "cocina", name: "Cocina", icon: "🍽️" },
                    { key: "dormitorio", name: "Dormitorio", icon: "🛏️" },
                  ].map((room) => (
                    <div
                      key={room.key}
                      className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{room.icon}</span>
                        <div>
                          <div className="text-sm font-medium text-slate-800">
                            {room.name}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setLight(room.key, "on")}
                          className="px-3 py-1.5 bg-emerald-600 text-white rounded-md text-sm font-medium hover:bg-emerald-700 transition-colors"
                        >
                          Encender
                        </button>
                        <button
                          onClick={() => setLight(room.key, "off")}
                          className="px-3 py-1.5 bg-slate-400 text-white rounded-md text-sm font-medium hover:bg-slate-500 transition-colors"
                        >
                          Apagar
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Control de todas las luces */}
                  <div className="pt-3 border-t border-slate-200">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium text-slate-700">
                        Todas las luces
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setLight("sala", "on");
                            setLight("cocina", "on");
                            setLight("dormitorio", "on");
                          }}
                          className="px-4 py-2 bg-emerald-600 text-white rounded-md text-sm font-medium hover:bg-emerald-700 transition-colors"
                        >
                          🔆 Encender Todas
                        </button>
                        <button
                          onClick={() => {
                            setLight("sala", "off");
                            setLight("cocina", "off");
                            setLight("dormitorio", "off");
                          }}
                          className="px-4 py-2 bg-slate-400 text-white rounded-md text-sm font-medium hover:bg-slate-500 transition-colors"
                        >
                          🌙 Apagar Todas
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 border rounded">
                <h3 className="font-medium mb-2">Puerta</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => operateServo(undefined, "open")}
                    className="px-3 py-1 bg-emerald-600 text-white rounded"
                  >
                    Abrir
                  </button>
                </div>
              </div>

              <div className="p-4 border rounded">
                <h3 className="font-medium mb-2">Bomba de riego</h3>
                <p className="text-sm text-slate-500 mb-3">
                  Estado: {actuators?.pump?.value ?? "N/A"}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => operatePump(true)}
                    className="px-3 py-1 bg-emerald-600 text-white rounded"
                  >
                    Activar
                  </button>
                  <button
                    onClick={() => operatePump(false)}
                    className="px-3 py-1 bg-slate-200 rounded"
                  >
                    Detener
                  </button>
                </div>
              </div>

              <div className="p-4 border rounded">
                <h3 className="font-medium mb-2">Ventilador / A/C</h3>
                <p className="text-sm text-slate-500 mb-3">
                  Estado: {actuators?.fan?.value ?? "N/A"}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => operateFan(true)}
                    className="px-3 py-1 bg-emerald-600 text-white rounded"
                  >
                    Encender
                  </button>
                  <button
                    onClick={() => operateFan(false)}
                    className="px-3 py-1 bg-slate-200 rounded"
                  >
                    Apagar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Historial y paginación */}
        {/* Acciones de Actuadores */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-5 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-800">Acciones de Actuadores</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => loadActions(actionsPage)}
                className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700 active:scale-[.98] transition disabled:opacity-50"
              >
                <RefreshCw className="size-4" /> Actualizar
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 text-slate-600 text-xs uppercase">
                <tr>
                  <th className="text-left font-semibold px-5 py-3">Fecha y Hora</th>
                  <th className="text-left font-semibold px-5 py-3">Tipo</th>
                  <th className="text-left font-semibold px-5 py-3">Valor</th>
                  <th className="text-left font-semibold px-5 py-3">Descripción</th>
                  <th className="text-left font-semibold px-5 py-3">Ubicación</th>
                </tr>
              </thead>
              <tbody>
                {actionsLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="border-t border-slate-100 animate-pulse">
                      <td className="px-5 py-3"><div className="h-3 w-40 bg-slate-200 rounded" /></td>
                      <td className="px-5 py-3"><div className="h-3 w-20 bg-slate-200 rounded" /></td>
                      <td className="px-5 py-3"><div className="h-3 w-16 bg-slate-200 rounded" /></td>
                      <td className="px-5 py-3"><div className="h-3 w-48 bg-slate-200 rounded" /></td>
                      <td className="px-5 py-3"><div className="h-3 w-24 bg-slate-200 rounded" /></td>
                    </tr>
                  ))
                ) : actions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-slate-500 text-sm">No hay acciones registradas.</td>
                  </tr>
                ) : (
                  actions.map((a: any) => (
                    <tr key={a.id} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-5 py-3 whitespace-nowrap text-slate-700">{a.timestamp ? formatDate(a.timestamp) : '—'}</td>
                      <td className="px-5 py-3 capitalize">{a.type}</td>
                      <td className="px-5 py-3">{String(a.value ?? '—')}</td>
                      <td className="px-5 py-3">{a.description || '—'}</td>
                      <td className="px-5 py-3">{a.location || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {actionsPages > 1 && (
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-5 py-4 border-t border-slate-200 text-sm">
              <div className="text-slate-600">
                Mostrando <strong>{(actionsPage - 1) * actionsLimit + (actions.length ? 1 : 0)}</strong> a <strong>{(actionsPage - 1) * actionsLimit + actions.length}</strong> de <strong>{actionsTotal}</strong> acciones
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { if (actionsPage > 1) { const p = actionsPage - 1; setActionsPage(p); loadActions(p); } }}
                  disabled={actionsPage <= 1}
                  className="px-3 h-9 rounded-md border text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >Anterior</button>
                {Array.from({ length: actionsPages }, (_, i) => i + 1).slice(0, 5).map(p => (
                  <button
                    key={p}
                    onClick={() => { setActionsPage(p); loadActions(p); }}
                    className={`px-3 h-9 rounded-md border text-slate-700 bg-white hover:bg-slate-50 ${p === actionsPage ? 'bg-slate-800 text-white border-slate-800 hover:bg-slate-700' : ''}`}
                  >{p}</button>
                ))}
                <button
                  onClick={() => { if (actionsPage < actionsPages) { const p = actionsPage + 1; setActionsPage(p); loadActions(p); } }}
                  disabled={actionsPage >= actionsPages}
                  className="px-3 h-9 rounded-md border text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >Siguiente</button>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="flex flex-col gap-4 p-5 border-b border-slate-200 md:flex-row md:items-center md:justify-between">
            <h2 className="text-lg font-semibold text-slate-800">
              Historial de Lecturas
            </h2>
            <div className="flex items-center gap-3">
              <button
                onClick={() => fetchPage(pagination?.page ?? 1)}
                className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700 active:scale-[.98] transition disabled:opacity-50"
              >
                <RefreshCw className="size-4" /> Actualizar
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <table className="min-w-full text-sm">
                <thead className="bg-slate-100 text-slate-600 text-xs uppercase">
                  <tr>
                    <th className="text-left font-semibold px-5 py-3">
                      Fecha y Hora
                    </th>
                    <th className="text-left font-semibold px-5 py-3">
                      Temperatura (°C)
                    </th>
                    <th className="text-left font-semibold px-5 py-3">
                      Humedad (%)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <tr
                      key={i}
                      className="border-t border-slate-100 animate-pulse"
                    >
                      <td className="px-5 py-3">
                        <div className="h-3 w-40 bg-slate-200 rounded" />
                      </td>
                      <td className="px-5 py-3">
                        <div className="h-3 w-24 bg-slate-200 rounded" />
                      </td>
                      <td className="px-5 py-3">
                        <div className="h-3 w-24 bg-slate-200 rounded" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="min-w-full text-sm">
                <thead className="bg-slate-100 text-slate-600 text-xs uppercase">
                  <tr>
                    <th className="text-left font-semibold px-5 py-3">
                      Fecha y Hora
                    </th>
                    <th className="text-left font-semibold px-5 py-3">
                      Temperatura (°C)
                    </th>
                    <th className="text-left font-semibold px-5 py-3">
                      Humedad (%)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {
                    // Pair temperature and humidity readings by timestamp (exact match by ISO second)
                    (() => {
                      const items = (readings || []).filter(
                        (r: any) =>
                          r.type === "temperature" || r.type === "humidity"
                      );
                      const mapByTs = new Map();
                      items.forEach((r: any) => {
                        const key = r.timestamp
                          ? r.timestamp.slice(0, 19)
                          : r.timestamp;
                        if (!mapByTs.has(key))
                          mapByTs.set(key, {
                            temp: null,
                            hum: null,
                            ts: r.timestamp,
                          });
                        const entry = mapByTs.get(key);
                        if (r.type === "temperature") entry.temp = r;
                        if (r.type === "humidity") entry.hum = r;
                      });
                      const rows = Array.from(mapByTs.values()).sort(
                        (a: any, b: any) =>
                          new Date(b.ts).getTime() - new Date(a.ts).getTime()
                      );
                      return rows.map((row: any, idx: number) => {
                        const t = row.temp;
                        const h = row.hum;
                        const ts =
                          row.ts ||
                          (t && t.timestamp) ||
                          (h && h.timestamp) ||
                          null;
                        return (
                          <tr
                            key={idx}
                            className="border-t border-slate-100 hover:bg-slate-50"
                          >
                            <td className="px-5 py-3 whitespace-nowrap text-slate-700">
                              {formatDate(ts)}
                            </td>
                            <td className="px-5 py-3">
                              <div
                                className={`inline-flex items-center gap-2 font-medium ${temperatureColor(
                                  t?.temperature ?? Number(t?.value) ?? 0
                                )}`}
                              >
                                <Thermometer className="size-4 opacity-80" />{" "}
                                {t
                                  ? (t.temperature ?? t.value) +
                                    (t.unit ? ` ${t.unit}` : " °C")
                                  : "—"}
                              </div>
                            </td>
                            <td className="px-5 py-3">
                              <div
                                className={`inline-flex items-center gap-2 font-medium ${humidityColor(
                                  h?.humidity ?? Number(h?.value) ?? 0
                                )}`}
                              >
                                <Droplets className="size-4 opacity-80" />{" "}
                                {h
                                  ? (h.humidity ?? h.value) +
                                    (h.unit ? ` ${h.unit}` : " %")
                                  : "—"}
                              </div>
                            </td>
                          </tr>
                        );
                      });
                    })()
                  }
                  {readings.length === 0 && (
                    <tr>
                      <td
                        colSpan={3}
                        className="px-5 py-10 text-center text-slate-500 text-sm"
                      >
                        No hay lecturas disponibles.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-5 py-4 border-t border-slate-200 text-sm">
              <div className="text-slate-600">
                Mostrando{" "}
                <strong>{(pagination.page - 1) * pagination.limit + 1}</strong>{" "}
                a{" "}
                <strong>
                  {Math.min(
                    pagination.page * pagination.limit,
                    pagination.total
                  )}
                </strong>{" "}
                de <strong>{pagination.total}</strong> resultados
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const p = pagination.page - 1;
                    if (p >= 1) {
                      setPage(p);
                      fetchPage(p);
                    }
                  }}
                  disabled={pagination.page <= 1}
                  className="px-3 h-9 rounded-md border text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Anterior
                </button>
                {Array.from(
                  { length: Math.min(5, pagination.pages) },
                  (_, i) => i + 1
                ).map((pageNum) => (
                  <button
                    key={pageNum}
                    onClick={() => {
                      setPage(pageNum);
                      fetchPage(pageNum);
                    }}
                    className={`px-3 h-9 rounded-md border text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-40 ${
                      pageNum === pagination.page
                        ? "bg-slate-800 text-white border-slate-800 hover:bg-slate-700"
                        : ""
                    }`}
                  >
                    {pageNum}
                  </button>
                ))}
                <button
                  onClick={() => {
                    const p = pagination.page + 1;
                    if (p <= pagination.pages) {
                      setPage(p);
                      fetchPage(p);
                    }
                  }}
                  disabled={pagination.page >= pagination.pages}
                  className="px-3 h-9 rounded-md border text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
