const express = require('express');
const SensorReading = require('../models/SensorReading');
let devSeed = null;
const useDev = process.env.USE_DEV === 'true' || false;

const router = express.Router();

function sanitizeReading(doc) {
  if (!doc) return null;
  const obj = typeof doc.toObject === 'function' ? doc.toObject() : doc;

  const safeDateToISOString = (d) => {
    if (!d) return undefined;
    const dt = new Date(d);
    return !isNaN(dt.getTime()) ? dt.toISOString() : undefined;
  };

  const out = {
    id: obj._id ? String(obj._id) : undefined,
    type: obj.type,
    value: typeof obj.value !== 'undefined' && obj.value !== null ? obj.value : undefined,
    timestamp: safeDateToISOString(obj.timestamp),
    deviceTimestamp: safeDateToISOString(obj.deviceTimestamp),
  unit: obj.unit || undefined,
    description: obj.description || undefined,
    status: typeof obj.status === 'boolean' ? obj.status : undefined,
    color: obj.color || undefined,
    location: obj.location || undefined,
    connected: typeof obj.connected === 'boolean' ? obj.connected : undefined,
    pin: obj.pin || undefined,
    device: obj.device || undefined
  };

  Object.keys(out).forEach(k => out[k] === undefined && delete out[k]);
  return out;
}

function sanitizeArray(arr) {
  return Array.isArray(arr) ? arr.map(sanitizeReading) : [];
}

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

    const query = {};
    if (type) query.type = type;
    if (location) query.location = location;

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
      data: readings.map(sanitizeReading),
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

router.get('/latest', async (req, res) => {
  try {
    if (useDev && devSeed) {
      const reading = devSeed.latest();
      if (!reading) return res.status(404).json({ error: 'No se encontraron lecturas' });
      return res.json(sanitizeReading(reading));
    }

    const { type } = req.query;
    const query = type ? { type } : {};
    const reading = await SensorReading.findOne(query).sort({ timestamp: -1 });
    if (!reading) {
      return res.status(404).json({ error: 'No se encontraron lecturas' });
    }
    res.json(sanitizeReading(reading));
  } catch (error) {
    console.error('Error obteniendo última lectura:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

router.get('/stats', async (req, res) => {
  try {
    if (useDev && devSeed) {
      return res.json(devSeed.stats());
    }

  const stats = {};
  const temperature = await SensorReading.findOne({ type: 'temperature' }).sort({ timestamp: -1 });
  stats.temperature = sanitizeReading(temperature);
  const humidity = await SensorReading.findOne({ type: 'humidity' }).sort({ timestamp: -1 });
  stats.humidity = sanitizeReading(humidity);
  const lights = await SensorReading.find({ type: 'light' }).sort({ timestamp: -1 }).limit(5);
  stats.lights = sanitizeArray(lights);
  const door = await SensorReading.findOne({ type: 'door' }).sort({ timestamp: -1 });
  stats.door = sanitizeReading(door);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const motionCount = await SensorReading.countDocuments({ type: 'motion', timestamp: { $gte: today } });
    stats.motionToday = motionCount;
  const activeAlerts = await SensorReading.find({ type: 'alarm', status: true }).sort({ timestamp: -1 });
  stats.activeAlerts = sanitizeArray(activeAlerts);
    res.json(stats);
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

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

router.post('/readings', async (req, res) => {
  try {
    const body = req.body;
    if (!body || !body.type || typeof body.value === 'undefined') {
      return res.status(400).json({ error: 'Payload inválido - se requiere type y value' });
    }

    const reading = new SensorReading({
      type: body.type,
      value: body.value,
      unit: body.unit || null,
      description: body.description || null,
      status: typeof body.status === 'boolean' ? body.status : null,
      location: body.location || null,
      device: body.device || null,
      pin: body.pin || null,
      connected: typeof body.connected === 'boolean' ? body.connected : null,
      deviceTimestamp: body.deviceTimestamp ? new Date(body.deviceTimestamp) : null
    });

    await reading.save();
    if (global && typeof global.emitUpdate === 'function') {
      global.emitUpdate('sensor_update', sanitizeReading(reading));
    }
    return res.status(201).json({ success: true, reading: sanitizeReading(reading) });
  } catch (error) {
    console.error('Error guardando lectura desde dispositivo:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
