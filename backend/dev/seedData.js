// dev/seedData.js
// Datos de ejemplo para desarrollo sin Mongo/MQTT
const { v4: uuidv4 } = require('uuid');

const now = () => new Date();

// Generador simple de lecturas DHT11 (temperature, humidity)
function generateReading(overrides = {}) {
  const temp = Math.round((18 + Math.random() * 12) * 10) / 10; // 18-30
  const hum = Math.round((30 + Math.random() * 50) * 10) / 10; // 30-80
  return Object.assign({
    _id: uuidv4(),
    type: 'environment',
    temperature: temp,
    humidity: hum,
    timestamp: now().toISOString(),
    location: 'Casa'
  }, overrides);
}

// Inicializamos con 30 lecturas históricas
const readings = [];
for (let i = 0; i < 30; i++) {
  const past = new Date();
  past.setMinutes(past.getMinutes() - (30 - i) * 5);
  const r = generateReading({ timestamp: past.toISOString() });
  readings.push(r);
}

function getPaginated(page = 1, limit = 10) {
  const total = readings.length;
  const pages = Math.ceil(total / limit) || 1;
  const start = (page - 1) * limit;
  const data = readings.slice(start, start + limit).reverse(); // más recientes primero
  return { data, pagination: { page, limit, total, pages } };
}

function latest() {
  return readings[readings.length - 1] || null;
}

function stats() {
  const temps = readings.map(r => r.temperature);
  const hums = readings.map(r => r.humidity);
  const avg = arr => Math.round((arr.reduce((s, v) => s + v, 0) / (arr.length || 1)) * 10) / 10;
  return {
    temp: {
      min: Math.min(...temps).toFixed(1),
      avg: avg(temps).toFixed(1),
      max: Math.max(...temps).toFixed(1)
    },
    hum: {
      min: Math.min(...hums).toFixed(1),
      avg: avg(hums).toFixed(1),
      max: Math.max(...hums).toFixed(1)
    }
  };
}

function pushNewReading(reading) {
  readings.push(reading);
  // mantener tamaño razonable
  if (readings.length > 500) readings.shift();
}

module.exports = {
  generateReading,
  getPaginated,
  latest,
  stats,
  pushNewReading
};
