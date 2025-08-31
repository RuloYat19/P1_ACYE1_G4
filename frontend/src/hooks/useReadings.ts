import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface Reading {
  _id?: string;
  temperature: number;
  humidity: number;
  timestamp: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

interface UseReadingsOptions {
  apiUrl: string;
  initialLimit?: number;
  cache?: boolean;
}

interface UseReadingsReturn {
  readings: Reading[];
  latestReading: Reading | null;
  pagination: PaginationMeta;
  loading: boolean;
  error: string | null;
  stats: {
    temp: { min: number; max: number; avg: number };
    hum: { min: number; max: number; avg: number };
  } | null;
  fetchPage: (page?: number) => Promise<void>;
  refreshLatest: () => Promise<void>;
  setLatestReading: (r: Reading) => void;
  setPage: (p: number) => void;
}

const cacheKey = (limit: number) => `readings_cache_limit_${limit}`;

export function useReadings({ apiUrl, initialLimit = 20, cache = true }: UseReadingsOptions): UseReadingsReturn {
  const [readings, setReadings] = useState<Reading[]>([]);
  const [latestReading, setLatestReading] = useState<Reading | null>(null);
  const [pagination, setPagination] = useState<PaginationMeta>({ page: 1, limit: initialLimit, total: 0, pages: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Load cache
  useEffect(() => {
    if (!cache) return;
    try {
      const raw = localStorage.getItem(cacheKey(pagination.limit));
      if (raw) {
        const parsed = JSON.parse(raw);
        setReadings(parsed.readings || []);
        setPagination(parsed.pagination || pagination);
        setLatestReading(parsed.latestReading || null);
      }
    } catch {
      // ignore cache errors
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist cache
  useEffect(() => {
    if (!cache) return;
    try {
      localStorage.setItem(cacheKey(pagination.limit), JSON.stringify({ readings, pagination, latestReading }));
    } catch {
      // ignore
    }
  }, [cache, readings, pagination, latestReading]);

  const fetchPage = useCallback(async (page = 1) => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/api/readings?page=${page}&limit=${pagination.limit}`, { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setReadings(data.data || []);
      setPagination(data.pagination || { page, limit: pagination.limit, total: data.data?.length || 0, pages: 1 });
    } catch (e: any) {
      if (e.name === 'AbortError') return; // silent
      setError(e.message || 'Error al cargar lecturas');
    } finally {
      setLoading(false);
    }
  }, [apiUrl, pagination.limit]);

  const refreshLatest = useCallback(async () => {
    try {
      const res = await fetch(`${apiUrl}/api/readings/latest`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setLatestReading(data || null);
    } catch (e: any) {
      setError(prev => prev || e.message || 'Error al cargar última lectura');
    }
  }, [apiUrl]);

  useEffect(() => {
    fetchPage(1);
    refreshLatest();
  }, [fetchPage, refreshLatest]);

  const stats = useMemo(() => {
    if (!readings.length) return null;
    const temps = readings.map(r => r.temperature);
    const hums = readings.map(r => r.humidity);
    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
    return {
      temp: { min: Math.min(...temps), max: Math.max(...temps), avg: Number(avg(temps).toFixed(1)) },
      hum: { min: Math.min(...hums), max: Math.max(...hums), avg: Number(avg(hums).toFixed(1)) }
    };
  }, [readings]);

  const setPage = (p: number) => setPagination(meta => ({ ...meta, page: p }));

  return { readings, latestReading, pagination, loading, error, stats, fetchPage, refreshLatest, setLatestReading, setPage };
}
