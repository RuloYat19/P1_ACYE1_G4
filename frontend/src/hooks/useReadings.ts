import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export type Reading = {
  _id?: string;
  id?: string;
  type?: string;
  value?: number | string;
  temperature?: number;
  humidity?: number;
  unit?: string;
  timestamp: string;
  location?: string;
  device?: string;
};

export const useReadings = ({ apiUrl = API_URL } = {}) => {
  const [readings, setReadings] = useState<Reading[]>([]);
  const [latestReading, setLatestReading] = useState<Reading | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, limit: 20, total: 0 });

  const fetchPage = useCallback(async (page = 1, limit = 20) => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${apiUrl}/api/sensors`, { params: { page, limit } });
      const data = res.data || {};
      setReadings(data.data || []);
      setPagination({
        page: data.pagination?.page ?? 1,
        pages: data.pagination?.pages ?? 1,
        limit: data.pagination?.limit ?? limit,
        total: data.pagination?.total ?? 0
      });
      try {
        const s = await axios.get(`${apiUrl}/api/sensors/stats`);
        setStats(s.data);
      } catch (e) {
        // ignore
      }
    } catch (err: any) {
      setError(err.message || 'Error al cargar lecturas');
    } finally {
      setLoading(false);
    }
  }, [apiUrl]);

  const refreshLatest = useCallback(async () => {
    try {
      // fetch latest temperature and humidity separately and combine
      const [tempRes, humRes] = await Promise.allSettled([
        axios.get(`${apiUrl}/api/sensors/latest`, { params: { type: 'temperature' } }),
        axios.get(`${apiUrl}/api/sensors/latest`, { params: { type: 'humidity' } })
      ]);

      const combined: any = { timestamp: null };

      if (tempRes.status === 'fulfilled' && tempRes.value.status === 200) {
        combined.temperature = tempRes.value.data.value ?? tempRes.value.data.temperature ?? null;
        combined.tempUnit = tempRes.value.data.unit ?? '°C';
        combined.timestamp = combined.timestamp || tempRes.value.data.timestamp;
      }

      if (humRes.status === 'fulfilled' && humRes.value.status === 200) {
        combined.humidity = humRes.value.data.value ?? humRes.value.data.humidity ?? null;
        combined.humUnit = humRes.value.data.unit ?? '%';
        // choose the most recent timestamp
        if (!combined.timestamp || new Date(humRes.value.data.timestamp) > new Date(combined.timestamp)) {
          combined.timestamp = humRes.value.data.timestamp;
        }
      }

      if (combined.temperature !== undefined || combined.humidity !== undefined) {
        setLatestReading(combined as any);
      }
    } catch (err) {
      // ignore
    }
  }, [apiUrl]);

  useEffect(() => {
    fetchPage(1);
    refreshLatest();
  }, [fetchPage, refreshLatest]);

  return { readings, latestReading, setLatestReading, loading, error, stats, pagination, fetchPage, refreshLatest, setPage: (p:number)=>setPagination(prev=>({...prev,page:p})) };
};
