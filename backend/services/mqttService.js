const mqtt = require('mqtt');
const SensorReading = require('../models/SensorReading');

class MQTTService {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  connect() {
    const options = {
      host: process.env.MQTT_HOST || 'broker.hivemq.com',
      port: process.env.MQTT_PORT || 1883,
      protocol: 'mqtt',
      clientId: process.env.MQTT_CLIENT_ID || `backend-server-${Math.random().toString(16).substring(2, 10)}`
    };

    this.client = mqtt.connect(options);

    this.client.on('connect', () => {
      console.log('Conectado a MQTT broker');
      this.isConnected = true;

      // Suscribirse a los temas relevantes
      this.client.subscribe('/illumination', { qos: 0 });
      this.client.subscribe('/entrance', { qos: 0 });
      this.client.subscribe('/alerts', { qos: 0 });
      this.client.subscribe('/temperature', { qos: 0 });
      this.client.subscribe('/humidity', { qos: 0 });
      this.client.subscribe('/motion', { qos: 0 });
    });

    this.client.on('message', async (topic, message) => {
      console.log(`Mensaje recibido en ${topic}:`, message.toString());
      await this.processMessage(topic, message.toString());
    });

    this.client.on('error', (error) => {
      console.error('Error en MQTT:', error);
      this.isConnected = false;
    });

    this.client.on('offline', () => {
      console.log('MQTT client offline');
      this.isConnected = false;
    });
  }

  async processMessage(topic, message) {
    try {
      let data;
      try {
        data = JSON.parse(message);
      } catch (e) {
        // Si no es JSON, tratar como valor simple
        data = { value: message };
      }

      switch (topic) {
        case '/illumination':
          await this.processIllumination(data);
          break;
        case '/entrance':
          await this.processEntrance(data);
          break;
        case '/alerts':
          await this.processAlert(data);
          break;
        case '/temperature':
          await this.processTemperature(data);
          break;
        case '/humidity':
          await this.processHumidity(data);
          break;
        case '/motion':
          await this.processMotion(data);
          break;
        default:
          console.log(`No hay procesamiento definido para el tema: ${topic}`);
      }
    } catch (error) {
      console.error('Error procesando mensaje MQTT:', error);
    }
  }

  async processIllumination(data) {
    const reading = new SensorReading({
      type: 'light',
      value: data.color || data.state,
      description: data.room || 'LED RGB',
      status: data.state === 'on',
      color: data.color,
      location: data.room
    });
    await reading.save();
    console.log('Registro de iluminación guardado:', data);
  }

  async processEntrance(data) {
    const reading = new SensorReading({
      type: 'door',
      value: data.action,
      description: 'Puerta principal',
      status: data.action === 'open',
      location: 'entrance'
    });
    await reading.save();
    console.log('Registro de puerta guardado:', data);
  }

  async processAlert(data) {
    const reading = new SensorReading({
      type: 'alarm',
      value: data.message || 'Alerta activada',
      description: data.description || 'Sistema de alarma',
      status: true,
      location: data.location || 'general'
    });
    await reading.save();
    console.log('Registro de alerta guardado:', data);
  }

  async processTemperature(data) {
    const reading = new SensorReading({
      type: 'temperature',
      value: data.temperature,
      description: 'Sensor DHT11/DHT22',
      location: data.location || 'interior'
    });
    await reading.save();
    console.log('Registro de temperatura guardado:', data);
  }

  async processHumidity(data) {
    const reading = new SensorReading({
      type: 'humidity',
      value: data.humidity,
      description: 'Sensor DHT11/DHT22',
      location: data.location || 'interior'
    });
    await reading.save();
    console.log('Registro de humedad guardado:', data);
  }

  async processMotion(data) {
    // Solo registrar cuando pasa de bajo a alto
    if (data.motion === true || data.motion === 'detected') {
      const reading = new SensorReading({
        type: 'motion',
        value: 'detected',
        description: 'Sensor PIR',
        status: true,
        location: data.location || 'exterior'
      });
      await reading.save();
      console.log('Registro de movimiento guardado:', data);
    }
  }

  publishMessage(topic, message) {
    return new Promise((resolve, reject) => {
      if (!this.isConnected) {
        reject(new Error('MQTT client not connected'));
        return;
      }

      this.client.publish(topic, JSON.stringify(message), (error) => {
        if (error) {
          console.error(`Error publicando en ${topic}:`, error);
          reject(error);
        } else {
          console.log(`Mensaje publicado en ${topic}:`, message);
          resolve();
        }
      });
    });
  }

  disconnect() {
    if (this.client) {
      this.client.end();
      this.isConnected = false;
    }
  }
}

module.exports = new MQTTService();
