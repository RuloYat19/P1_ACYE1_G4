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

    // Publicar mensaje MQTT
    await mqttService.publishMessage('/illumination', { room, state, color });

    // Registrar en la base de datos
    const reading = new SensorReading({
      type: 'light',
      value: color || state,
      description: room,
      status: state === 'on',
      color: color,
      location: room
    });
    await reading.save();

    res.json({
      success: true,
      message: `Luz ${state === 'on' ? 'encendida' : 'apagada'} en ${room}`,
      data: reading
    });
  } catch (error) {
    console.error('Error controlando iluminación:', error);
    res.status(500).json({ error: 'Error controlando iluminación' });
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
    mqttService.publishMessage(`/illumination/room/${room}/control`, JSON.stringify(command));
    
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
      description: 'Puerta principal',
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
      description: `Bomba de riego - Humedad: ${humidity || 'N/A'}`,
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
    const { state, temperature } = req.body;

    if (typeof state !== 'boolean') {
      return res.status(400).json({ error: 'Se requiere estado (true/false)' });
    }

    // Publicar mensaje MQTT
    await mqttService.publishMessage('/fan', { state, temperature });

    // Registrar en la base de datos
    const reading = new SensorReading({
      type: 'fan',
      value: state ? 'on' : 'off',
      description: `Ventilador - Temperatura: ${temperature || 'N/A'}°C`,
      status: state,
      location: 'interior'
    });
    await reading.save();

    res.json({
      success: true,
      message: `Ventilador ${state ? 'activado' : 'desactivado'}`,
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
