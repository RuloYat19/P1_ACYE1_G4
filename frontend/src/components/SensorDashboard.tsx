import React, { useEffect, useState } from 'react';
import { Thermometer, Droplets, RefreshCw, Wifi, WifiOff, AlertTriangle } from 'lucide-react';
import { io } from 'socket.io-client';
import { useReadings } from '../hooks/useReadings';

const API_URL = 'http://localhost:3001';
const formatDate = (dateString: string) => new Date(dateString).toLocaleString('es-ES');

const temperatureColor = (t: number) => {
  if (t < 18) return 'text-sky-600';
  if (t < 27) return 'text-emerald-600';
  if (t < 30) return 'text-amber-600';
  return 'text-rose-600';
};
const humidityColor = (h: number) => {
  if (h < 30) return 'text-amber-600';
  if (h <= 60) return 'text-emerald-600';
  return 'text-sky-600';
};
const temperatureGradient = (t: number) => {
  if (t < 18) return 'from-sky-500 via-sky-600 to-indigo-600';
  if (t < 27) return 'from-emerald-500 via-emerald-600 to-teal-600';
  if (t < 30) return 'from-amber-500 via-orange-500 to-amber-600';
  return 'from-rose-500 via-red-500 to-orange-600';
};
const humidityGradient = (h: number) => {
  if (h < 30) return 'from-amber-400 via-amber-500 to-orange-500';
  if (h <= 60) return 'from-emerald-500 via-green-500 to-teal-500';
  return 'from-sky-500 via-blue-500 to-indigo-500';
};

const SensorDashboard: React.FC = () => {
  const { readings, latestReading, pagination, loading, error, stats, fetchPage, refreshLatest, setLatestReading, setPage } = useReadings({ apiUrl: API_URL });
  const [isConnected, setIsConnected] = useState(false);
  const [socketError, setSocketError] = useState<string | null>(null);

  useEffect(() => {
    const socket = io(API_URL, { transports: ['websocket'], reconnectionAttempts: 5 });
    socket.on('connect', () => { setIsConnected(true); setSocketError(null); });
    socket.on('disconnect', () => setIsConnected(false));
    socket.on('connect_error', (e) => setSocketError(e.message));
    socket.on('newReading', (data) => {
      setLatestReading(data);
      if (pagination.page === 1) {
        fetchPage(1);
      }
    });
    return () => { socket.disconnect(); };
  }, [fetchPage, pagination.page, setLatestReading]);

  const changePage = (page: number) => {
    if (page < 1 || page > pagination.pages) return;
    setPage(page);
    fetchPage(page);
  };

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 md:px-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col gap-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Dashboard de Sensores DHT11</h1>
              <p className="text-slate-500 text-sm">Monitoreo en tiempo real de temperatura y humedad</p>
            </div>
            <div>
              {isConnected ? (
                <span className="inline-flex items-center gap-2 text-sm font-medium text-green-600 bg-green-50 border border-green-200 px-3 py-1.5 rounded-full">
                  <Wifi className="size-4" /> Conectado
                </span>
              ) : (
                <span className="inline-flex items-center gap-2 text-sm font-medium text-rose-600 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-full">
                  <WifiOff className="size-4" /> Desconectado
                </span>
              )}
            </div>
          </div>
        </div>

        {(error || socketError) && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 flex gap-3 text-amber-800 text-sm">
            <AlertTriangle className="size-5 shrink-0" />
            <div>
              <p className="font-medium mb-1">Problema de conexión</p>
              {error && <p>API: {error}</p>}
              {socketError && <p>Socket: {socketError}</p>}
              <button onClick={() => { fetchPage(pagination.page); refreshLatest(); }} className="mt-2 inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md bg-amber-600 text-white hover:bg-amber-500">Reintentar</button>
            </div>
          </div>
        )}

        {latestReading && (
          <div className="grid gap-6 md:grid-cols-2">
            <div className={`group relative bg-gradient-to-br ${temperatureGradient(latestReading.temperature)} text-white rounded-3xl p-6 w-full overflow-hidden shadow-md transition-transform hover:-translate-y-1 hover:shadow-xl`}>
              <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_30%_30%,white,transparent_60%)]" />
              <div className="flex items-center gap-4">
                <div className="bg-white/20 rounded-2xl p-4 backdrop-blur-sm">
                  <Thermometer className="size-8" />
                </div>
                <div>
                  <div className="text-sm uppercase tracking-wide font-medium text-white/80">Temperatura Actual</div>
                  <div className="text-5xl font-bold leading-none drop-shadow-sm">{latestReading.temperature}°C</div>
                </div>
              </div>
              <div className="mt-4 text-xs text-white/70">Última actualización: {formatDate(latestReading.timestamp)}</div>
              {stats && (
                <div className="mt-5 grid grid-cols-3 gap-3 text-center text-xs">
                  <div className="bg-white/15 rounded-lg py-2"><div className="font-semibold">{stats.temp.min}°C</div><div className="opacity-70">Mín</div></div>
                  <div className="bg-white/15 rounded-lg py-2"><div className="font-semibold">{stats.temp.avg}°C</div><div className="opacity-70">Prom</div></div>
                  <div className="bg-white/15 rounded-lg py-2"><div className="font-semibold">{stats.temp.max}°C</div><div className="opacity-70">Máx</div></div>
                </div>
              )}
            </div>
            <div className={`group relative bg-gradient-to-br ${humidityGradient(latestReading.humidity)} text-white rounded-3xl p-6 w-full overflow-hidden shadow-md transition-transform hover:-translate-y-1 hover:shadow-xl`}>
              <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_70%_30%,white,transparent_60%)]" />
              <div className="flex items-center gap-4">
                <div className="bg-white/20 rounded-2xl p-4 backdrop-blur-sm">
                  <Droplets className="size-8" />
                </div>
                <div>
                  <div className="text-sm uppercase tracking-wide font-medium text-white/80">Humedad Actual</div>
                  <div className="text-5xl font-bold leading-none drop-shadow-sm">{latestReading.humidity}%</div>
                </div>
              </div>
              <div className="mt-4 text-xs text-white/70">Última actualización: {formatDate(latestReading.timestamp)}</div>
              {stats && (
                <div className="mt-5 grid grid-cols-3 gap-3 text-center text-xs">
                  <div className="bg-white/15 rounded-lg py-2"><div className="font-semibold">{stats.hum.min}%</div><div className="opacity-70">Mín</div></div>
                  <div className="bg-white/15 rounded-lg py-2"><div className="font-semibold">{stats.hum.avg}%</div><div className="opacity-70">Prom</div></div>
                  <div className="bg-white/15 rounded-lg py-2"><div className="font-semibold">{stats.hum.max}%</div><div className="opacity-70">Máx</div></div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="flex flex-col gap-4 p-5 border-b border-slate-200 md:flex-row md:items-center md:justify-between">
            <h2 className="text-lg font-semibold text-slate-800">Historial de Lecturas</h2>
            <div className="flex items-center gap-3">
              <button
                onClick={() => fetchPage(pagination.page)}
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
                    <th className="text-left font-semibold px-5 py-3">Fecha y Hora</th>
                    <th className="text-left font-semibold px-5 py-3">Temperatura (°C)</th>
                    <th className="text-left font-semibold px-5 py-3">Humedad (%)</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="border-t border-slate-100 animate-pulse">
                      <td className="px-5 py-3"><div className="h-3 w-40 bg-slate-200 rounded" /></td>
                      <td className="px-5 py-3"><div className="h-3 w-24 bg-slate-200 rounded" /></td>
                      <td className="px-5 py-3"><div className="h-3 w-24 bg-slate-200 rounded" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="min-w-full text-sm">
                <thead className="bg-slate-100 text-slate-600 text-xs uppercase">
                  <tr>
                    <th className="text-left font-semibold px-5 py-3">Fecha y Hora</th>
                    <th className="text-left font-semibold px-5 py-3">Temperatura (°C)</th>
                    <th className="text-left font-semibold px-5 py-3">Humedad (%)</th>
                  </tr>
                </thead>
                <tbody>
                  {readings.map((r, idx) => (
                    <tr key={r._id || idx} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-5 py-3 whitespace-nowrap text-slate-700">{formatDate(r.timestamp)}</td>
                      <td className="px-5 py-3">
                        <div className={`inline-flex items-center gap-2 font-medium ${temperatureColor(r.temperature)}`}>
                          <Thermometer className="size-4 opacity-80" /> {r.temperature}°C
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className={`inline-flex items-center gap-2 font-medium ${humidityColor(r.humidity)}`}>
                          <Droplets className="size-4 opacity-80" /> {r.humidity}%
                        </div>
                      </td>
                    </tr>
                  ))}
                  {readings.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-5 py-10 text-center text-slate-500 text-sm">No hay lecturas disponibles.</td>
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
                Mostrando <strong>{((pagination.page - 1) * pagination.limit) + 1}</strong> a <strong>{Math.min(pagination.page * pagination.limit, pagination.total)}</strong> de <strong>{pagination.total}</strong> resultados
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => changePage(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  className="px-3 h-9 rounded-md border text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >Anterior</button>
                {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => i + 1).map(pageNum => (
                  <button
                    key={pageNum}
                    onClick={() => changePage(pageNum)}
                    className={`px-3 h-9 rounded-md border text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-40 ${pageNum === pagination.page ? 'bg-slate-800 text-white border-slate-800 hover:bg-slate-700' : ''}`}
                  >{pageNum}</button>
                ))}
                <button
                  onClick={() => changePage(pagination.page + 1)}
                  disabled={pagination.page >= pagination.pages}
                  className="px-3 h-9 rounded-md border text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >Siguiente</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SensorDashboard;
