const express = require('express');
const SensorReading = require('../models/SensorReading');
const mqttService = require('../services/mqttService');

const router = express.Router();

// Control de iluminación
router.post('/light', async (req, res) => {
  try {
    const { room, state, color } = req.body;

    if (!room || !state) {
      return res.status(400).json({ error: 'Se requiere habitación y estado' });
    }

  // Publicar mensaje MQTT con habitación específica (corregido '/illumination')
  await mqttService.publishMessage('/illumination', { 
      room: room.toLowerCase(), 
      state, 
      color 
    });

    // Registrar en la base de datos
    const reading = new SensorReading({
      type: 'light',
      value: state,
      description: `LED ${room}`,
      status: state === 'on',
      color: color,
      location: room,
      device: 'room_led'
    });
    await reading.save();

    res.json({
      success: true,
      message: `Luz ${state === 'on' ? 'encendida' : 'apagada'} en ${room}`,
      room: room,
      state: state,
      data: reading
    });
  } catch (error) {
    console.error('Error controlando iluminación:', error);
    res.status(500).json({ error: 'Error controlando iluminación' });
  }
});

//servo
router.post('/servo', async (req, res) => {
  try {
    const body = req.body || {};
    const action = (body.action || body.position || (body.open ? 'open' : undefined));
    if (!action || action !== 'open') {
      return res.status(400).json({ error: 'Se requiere action: "open"' });
    }
    const topic = '/door';
    const message = { action: 'open' };
    await mqttService.publishMessage(topic, message);

    // Registrar acción
    const reading = new SensorReading({
      type: 'door',
      value: 'open',
      description: 'Puerta abierta (servo)',
      status: true,
      location: 'entrance',
      device: 'servo'
    });
    await reading.save();
    res.status(200).json({ success: true, topic, message, data: reading });
  } catch (error) {
    console.error('Error controlando servo:', error);
    return res.status(500).json({ error: 'Error interno' });
  }
});


// Control led RGB
router.post('/light/rgb', async (req, res) => {
  try {
    const { room = 'default', color, rgb, hex, brightness } = req.body;
    
    let command = {
      room: room,
      timestamp: new Date().toISOString()
    };
    
    if (color) {
      command.color = color;
    }
    
    if (rgb) {
      command.rgb = rgb;
    }
    
    if (hex) {
      command.hex = hex;
    }
    
    if (brightness !== undefined) {
      command.brightness = Math.max(0, Math.min(100, brightness));
    }
    
    // Publicar comando a MQTT
  mqttService.publishMessage(`/illumination/control`, command);
    
    // Guardar en base de datos
    const reading = new SensorReading({
      type: 'light',
      value: color || hex || JSON.stringify(rgb),
      description: `RGB LED ${room}`,
      status: true,
      color: color || hex,
      location: room,
      device: 'rgb_led'
    });
    
    await reading.save();
    
    res.json({ 
      success: true, 
      message: 'Comando de LED RGB enviado',
      command: command
    });
    
  } catch (error) {
    console.error('Error controlando LED RGB:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Obtener estado actual de LEDs
router.get('/lights/status', async (req, res) => {
  try {
    const latestLights = await SensorReading.find({ 
      type: 'light' 
    })
    .sort({ timestamp: -1 })
    .limit(10);
    
    res.json(latestLights);
  } catch (error) {
    console.error('Error obteniendo estado de luces:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Control de puerta
router.post('/door', async (req, res) => {
  try {
    const { action } = req.body;

    if (!action || !['open', 'close'].includes(action)) {
      return res.status(400).json({ error: 'Acción inválida. Use "open" o "close"' });
    }

    // Publicar mensaje MQTT
    await mqttService.publishMessage('/entrance', { action });

    // Registrar en la base de datos
    const reading = new SensorReading({
      type: 'door',
      value: action,
      description: action === 'open' ? 'Puerta principal abierta' : 'Puerta principal cerrada',
      status: action === 'open',
      location: 'entrance'
    });
    await reading.save();

    res.json({
      success: true,
      message: `Puerta ${action === 'open' ? 'abierta' : 'cerrada'}`,
      data: reading
    });
  } catch (error) {
    console.error('Error controlando puerta:', error);
    res.status(500).json({ error: 'Error controlando puerta' });
  }
});

// Control de bomba de agua
router.post('/pump', async (req, res) => {
  try {
    const { state, humidity } = req.body;

    if (typeof state !== 'boolean') {
      return res.status(400).json({ error: 'Se requiere estado (true/false)' });
    }

    // Publicar mensaje MQTT
    await mqttService.publishMessage('/pump', { state, humidity });

    // Registrar en la base de datos
    const reading = new SensorReading({
      type: 'pump',
      value: state ? 'on' : 'off',
      description: state ? `Bomba activada (Humedad: ${humidity || 'N/A'})` : 'Bomba desactivada',
      status: state,
      location: 'garden'
    });
    await reading.save();

    res.json({
      success: true,
      message: `Bomba de agua ${state ? 'activada' : 'desactivada'}`,
      data: reading
    });
  } catch (error) {
    console.error('Error controlando bomba:', error);
    res.status(500).json({ error: 'Error controlando bomba' });
  }
});

// Control de ventilador
router.post('/fan', async (req, res) => {
  try {
    const { fan, state } = req.body || {};
    const raw = typeof state === 'string' ? state : fan;
    const value = typeof raw === 'string' ? raw.toLowerCase().trim() : null;

    if (!value || !['on', 'off'].includes(value)) {
      return res.status(400).json({ error: 'Se requiere "state" o "fan" con valor "on" u "off"' });
    }

    await mqttService.publishMessage('/fan', { state: value });

    const reading = new SensorReading({
      type: 'fan',
      value,
      description: 'Ventilador',
      status: value === 'on',
      location: 'interior'
    });
    await reading.save();

    res.json({
      success: true,
      message: `Ventilador ${value === 'on' ? 'activado' : 'desactivado'}`,
      data: reading
    });
  } catch (error) {
    console.error('Error controlando ventilador:', error);
    res.status(500).json({ error: 'Error controlando ventilador' });
  }
});

// Obtener estado actual de actuadores
router.get('/status', async (req, res) => {
  try {
    const actuators = {};

    // Estado de luces
    const lights = await SensorReading.find({ type: 'light' })
      .sort({ timestamp: -1 })
      .limit(10);
    actuators.lights = lights;

    // Estado de puerta
    const door = await SensorReading.findOne({ type: 'door' })
      .sort({ timestamp: -1 });
    actuators.door = door;

    // Estado de bomba
    const pump = await SensorReading.findOne({ type: 'pump' })
      .sort({ timestamp: -1 });
    actuators.pump = pump;

    // Estado de ventilador
    const fan = await SensorReading.findOne({ type: 'fan' })
      .sort({ timestamp: -1 });
    actuators.fan = fan;

    res.json(actuators);
  } catch (error) {
    console.error('Error obteniendo estado de actuadores:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

module.exports = router;

// Historial de acciones de actuadores con paginación
router.get('/actions', async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const skip = (page - 1) * limit;
    const actionTypes = ['fan','light','door','pump','alarm','motion'];
    const filters = { type: { $in: actionTypes } };
    const [total, docs] = await Promise.all([
      SensorReading.countDocuments(filters),
      SensorReading.find(filters).sort({ timestamp: -1 }).skip(skip).limit(limit)
    ]);
    res.json({
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
      data: docs.map(r => ({
        id: r._id,
        type: r.type,
        value: r.value,
        status: r.status,
        description: r.description,
        location: r.location,
        timestamp: r.timestamp
      }))
    });
  } catch (e) {
    console.error('Error obteniendo acciones:', e);
    res.status(500).json({ error: 'Error obteniendo acciones' });
  }
});
