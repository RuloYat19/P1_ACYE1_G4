const mongoose = require('mongoose');

const sensorReadingSchema = new mongoose.Schema({
  type: {
    type: String,
  enum: ['temperature', 'humidity', 'motion', 'light', 'door', 'pump', 'alarm', 'soil'],
    required: true
  },
  value: {
    type: mongoose.Schema.Types.Mixed, 
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  description: {
    type: String,
    default: ''
  },
  // Para actuadores (encendido/apagado)
  status: {
    type: Boolean,
    default: null
  },
  // Para LEDs RGB
  color: {
    type: String,
    default: null
  },
  // Para ubicación/habitación
  location: {
    type: String,
    default: ''
  }
  ,
  // Campos opcionales para sensores/actuadores adicionales
  connected: {
    type: Boolean,
    default: null
  },
  pin: {
    type: String,
    default: null
  },
  device: {
    type: String,
    default: null
  },
  // unidad de la medida (ej: '°C', '%', 'digital')
  unit: {
    type: String,
    default: null
  },
  deviceTimestamp: {
    type: Date,
    default: null
  }
});

sensorReadingSchema.index({ type: 1, timestamp: -1 });
sensorReadingSchema.index({ timestamp: -1 });

module.exports = mongoose.model('SensorReading', sensorReadingSchema);
