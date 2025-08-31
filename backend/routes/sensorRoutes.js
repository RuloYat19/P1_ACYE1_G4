const express = require('express');
const SensorReading = require('../models/SensorReading');
let devSeed = null;
const useDev = process.env.DEV_SEED === 'true';
if (useDev) {
  try {
    devSeed = require('../dev/seedData');
    console.log('⚙️  Usando datos de desarrollo (DEV_SEED=true)');
  } catch (err) {
    console.warn('No se pudo cargar dev/seedData:', err.message);
    devSeed = null;
  }
}

const router = express.Router();

// Obtener lecturas con paginación y filtros
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    if (useDev && devSeed) {
      const result = devSeed.getPaginated(page, limit);
      return res.json({ data: result.data, pagination: result.pagination });
    }

    const skip = (page - 1) * limit;
    const { type, startDate, endDate, location } = req.query;

    // Construir filtros
    const query = {};
    if (type) query.type = type;
    if (location) query.location = location;

    // Filtro por fecha
    if (startDate && endDate) {
      query.timestamp = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const total = await SensorReading.countDocuments(query);
    const pages = Math.ceil(total / limit);

    const readings = await SensorReading.find(query)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      data: readings,
      pagination: {
        page,
        limit,
        total,
        pages
      }
    });
  } catch (error) {
    console.error('Error obteniendo lecturas:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Obtener la lectura más reciente
router.get('/latest', async (req, res) => {
  try {
    if (useDev && devSeed) {
      const reading = devSeed.latest();
      if (!reading) return res.status(404).json({ error: 'No se encontraron lecturas' });
      return res.json(reading);
    }

    const { type } = req.query;
    const query = type ? { type } : {};
    const reading = await SensorReading.findOne(query).sort({ timestamp: -1 });
    if (!reading) {
      return res.status(404).json({ error: 'No se encontraron lecturas' });
    }
    res.json(reading);
  } catch (error) {
    console.error('Error obteniendo última lectura:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Obtener estadísticas para el dashboard
router.get('/stats', async (req, res) => {
  try {
    if (useDev && devSeed) {
      return res.json(devSeed.stats());
    }

    const stats = {};
    const temperature = await SensorReading.findOne({ type: 'temperature' }).sort({ timestamp: -1 });
    stats.temperature = temperature;
    const humidity = await SensorReading.findOne({ type: 'humidity' }).sort({ timestamp: -1 });
    stats.humidity = humidity;
    const lights = await SensorReading.find({ type: 'light' }).sort({ timestamp: -1 }).limit(5);
    stats.lights = lights;
    const door = await SensorReading.findOne({ type: 'door' }).sort({ timestamp: -1 });
    stats.door = door;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const motionCount = await SensorReading.countDocuments({ type: 'motion', timestamp: { $gte: today } });
    stats.motionToday = motionCount;
    const activeAlerts = await SensorReading.find({ type: 'alarm', status: true }).sort({ timestamp: -1 });
    stats.activeAlerts = activeAlerts;
    res.json(stats);
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Obtener datos para gráficas
router.get('/chart', async (req, res) => {
  try {
    const { type, days = 7 } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const query = {
      type,
      timestamp: { $gte: startDate }
    };

    const readings = await SensorReading.find(query)
      .sort({ timestamp: 1 })
      .select('value timestamp');

    // Agrupar por fecha/hora según el tipo
    const groupedData = readings.reduce((acc, reading) => {
      const date = new Date(reading.timestamp);
      const key = type === 'temperature' || type === 'humidity'
        ? date.toISOString().slice(0, 13) // Por hora
        : date.toISOString().slice(0, 10); // Por día

      if (!acc[key]) {
        acc[key] = { date: key, values: [] };
      }
      acc[key].values.push(reading.value);
      return acc;
    }, {});

    // Calcular promedio para cada período
    const chartData = Object.values(groupedData).map(item => ({
      date: item.date,
      value: item.values.reduce((sum, val) => sum + val, 0) / item.values.length,
      count: item.values.length
    }));

    res.json(chartData);
  } catch (error) {
    console.error('Error obteniendo datos de gráfica:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

module.exports = router;
