import { Router } from 'express';
import { 
  listReadings, 
  latestReading, 
  aggregateReadings, 
  getStats, 
  insertReading 
} from '../services/readingsService.js';

const router = Router();

/**
 * GET /api/readings - Obtener todas las lecturas con paginación
 * Query params: page, limit, from, to, type, device_id
 */
router.get('/', async (req, res) => {
  try {
    const { page, limit, from, to, type, device_id } = req.query;
    const result = await listReadings({
      page: Number(page) || 1,
      limit: Number(limit) || 50,
      from,
      to,
      type,
      device_id
    });
    res.json(result);
  } catch (error) {
    console.error('[API] Error listando lecturas:', error);
    res.status(500).json({ 
      error: 'Error listando lecturas',
      message: error.message 
    });
  }
});

/**
 * GET /api/readings/latest - Obtener la lectura más reciente
 */
router.get('/latest', async (req, res) => {
  try {
    const latest = await latestReading();
    if (!latest) {
      return res.status(404).json({ 
        error: 'No se encontraron lecturas' 
      });
    }
    res.json(latest);
  } catch (error) {
    console.error('[API] Error obteniendo última lectura:', error);
    res.status(500).json({ 
      error: 'Error obteniendo última lectura',
      message: error.message 
    });
  }
});

/**
 * GET /api/readings/stats - Obtener estadísticas generales
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await getStats();
    res.json(stats);
  } catch (error) {
    console.error('[API] Error obteniendo estadísticas:', error);
    res.status(500).json({ 
      error: 'Error obteniendo estadísticas',
      message: error.message 
    });
  }
});

/**
 * GET /api/readings/aggregate - Obtener datos agregados por tiempo
 * Query params: from (required), to (required), group (hour|day)
 */
router.get('/aggregate', async (req, res) => {
  try {
    const { from, to, group } = req.query;
    
    if (!from || !to) {
      return res.status(400).json({ 
        error: 'Parámetros from y to son requeridos',
        example: '?from=2024-01-01T00:00:00Z&to=2024-01-02T00:00:00Z'
      });
    }
    
    const rows = await aggregateReadings({ from, to, group });
    res.json(rows);
  } catch (error) {
    console.error('[API] Error agregando lecturas:', error);
    res.status(500).json({ 
      error: 'Error agregando lecturas',
      message: error.message 
    });
  }
});

/**
 * POST /api/readings - Insertar nueva lectura
 * Body: { temperature: number, humidity: number, device_id?: string }
 */
router.post('/', async (req, res) => {
  try {
    const { temperature, humidity, device_id } = req.body;
    
    // Validación básica
    if (typeof temperature !== 'number' || typeof humidity !== 'number') {
      return res.status(400).json({
        error: 'temperature y humidity deben ser números',
        received: { temperature: typeof temperature, humidity: typeof humidity }
      });
    }
    
    const result = await insertReading({
      temperature,
      humidity,
      device_id
    });
    
    res.status(201).json({
      success: true,
      insertedId: result.insertedId,
      message: 'Lectura insertada correctamente'
    });
  } catch (error) {
    console.error('[API] Error insertando lectura:', error);
    res.status(400).json({ 
      error: 'Error insertando lectura',
      message: error.message 
    });
  }
});

/**
 * GET /api/readings/health - Health check específico para lecturas
 */
router.get('/health', async (req, res) => {
  try {
    const latest = await latestReading();
    const stats = await getStats();
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: {
        connected: true,
        lastReading: latest?.timestamp,
        totalReadings: stats.count
      }
    });
  } catch (error) {
    console.error('[API] Error en health check:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

export default router;
