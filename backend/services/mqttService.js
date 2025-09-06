const mqtt = require("mqtt");
const SensorReading = require("../models/SensorReading");

class MQTTService {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  connect() {
    const options = {
      host: process.env.MQTT_HOST || "your-cluster-url.hivemq.cloud",
      port: process.env.MQTT_PORT || 8883,
      protocol: "mqtts", 
      username: process.env.MQTT_USERNAME,
      password: process.env.MQTT_PASSWORD,
      clientId:
        process.env.MQTT_CLIENT_ID ||
        `backend-server-${Math.random().toString(16).substring(2, 10)}`,
      clean: true,
      connectTimeout: 4000,
      reconnectPeriod: 1000,
      rejectUnauthorized: true,
    };

    this.client = mqtt.connect(options);

    this.client.on("connect", () => {
      console.log("Conectado a MQTT broker");
      this.isConnected = true;

      // Suscribirse a los temas relevantes
      this.client.subscribe("/illumination", { qos: 0 });
      this.client.subscribe("/entrance", { qos: 0 });
      this.client.subscribe("/alerts", { qos: 0 });
      // Suscribir a los topics usados por los scripts en la placa (español)
      this.client.subscribe("/temperatura", { qos: 0 });
      this.client.subscribe("/humedad_aire", { qos: 0 });
      this.client.subscribe("/humedad_suelo", { qos: 0 });
      this.client.subscribe("/motion", { qos: 0 });
    });

    this.client.on("message", async (topic, message) => {
      console.log(`Mensaje recibido en ${topic}:`, message.toString());
      await this.processMessage(topic, message.toString());
    });

    this.client.on("error", (error) => {
      console.error("Error en MQTT:", error);
      this.isConnected = false;
    });

    this.client.on("offline", () => {
      console.log("MQTT client offline");
      this.isConnected = false;
    });
  }

  async processMessage(topic, message) {
    try {
      let data;
      try {
        data = JSON.parse(message);
      } catch (e) {
        data = { value: message };
      }

      switch (topic) {
        case "/illumination":
          await this.processIllumination(data);
          break;
        case "/entrance":
          await this.processEntrance(data);
          break;
        case "/alerts":
          await this.processAlert(data);
          break;
        case "/temperatura":
          await this.processTemperature(data);
          break;
        case "/humedad_aire":
          await this.processHumidity(data);
          break;
        case "/humedad_suelo":
          await this.processSoil(data);
          break;
        case "/motion":
          await this.processMotion(data);
          break;
        default:
          console.log(`No hay procesamiento definido para el tema: ${topic}`);
      }
    } catch (error) {
      console.error("Error procesando mensaje MQTT:", error);
    }
  }

  async processIllumination(data) {
    const reading = new SensorReading({
      type: "light",
      value: data.color || data.state,
      description: data.room || "LED RGB",
      status: data.state === "on",
      color: data.color,
      location: data.room,
    });
    await reading.save();
    console.log("Registro de iluminación guardado:", data);
  }

  async processEntrance(data) {
    const reading = new SensorReading({
      type: "door",
      value: data.action,
      description: "Puerta principal",
      status: data.action === "open",
      location: "entrance",
    });
    await reading.save();
    console.log("Registro de puerta guardado:", data);
  }

  async processAlert(data) {
    const reading = new SensorReading({
      type: "alarm",
      value: data.message || "Alerta activada",
      description: data.description || "Sistema de alarma",
      status: true,
      location: data.location || "general",
    });
    await reading.save();
    console.log("Registro de alerta guardado:", data);
  }

  async processTemperature(data) {
    const deviceTs = data.timestamp ? new Date(data.timestamp) : null;
    const timestamp = new Date(); // server timestamp
    const reading = new SensorReading({
      type: 'temperature',
      value: isNaN(Number(data.temperature)) ? null : Number(data.temperature),
      unit: '°C',
      description: data.description || `Lectura ${data.device || 'DHT'} en ${data.location || 'interior'}`,
      location: data.location || 'interior',
      device: data.device || null,
      deviceTimestamp: deviceTs,
  timestamp,
  pin: data.pin || null,
  connected: typeof data.connected === 'boolean' ? data.connected : null
    });
    // avoid saving entries with null value for temperature
    if (reading.value === null) {
      console.log('Temperatura inválida, no se guarda:', data);
      return;
    }
    await reading.save();
    console.log("Registro de temperatura guardado:", reading._id);
  }

  async processHumidity(data) {
    const deviceTs = data.timestamp ? new Date(data.timestamp) : null;
    const timestamp = new Date();
    const reading = new SensorReading({
      type: 'humidity',
      value: isNaN(Number(data.humidity)) ? null : Number(data.humidity),
      unit: '%',
      description: data.description || `Lectura ${data.device || 'DHT'} en ${data.location || 'interior'}`,
      location: data.location || 'interior',
      device: data.device || null,
      deviceTimestamp: deviceTs,
  timestamp,
  pin: data.pin || null,
  connected: typeof data.connected === 'boolean' ? data.connected : null
    });
    if (reading.value === null) {
      console.log('Humedad inválida, no se guarda:', data);
      return;
    }
    await reading.save();
    console.log("Registro de humedad guardado:", reading._id);
  }

  async processSoil(data) {
    try {
        if (typeof data.connected === 'boolean' && data.connected === false) {
          console.log('Lectura de humedad de suelo ignorada: sensor no conectado');
          return;
        }
      const timestamp = data.timestamp ? new Date(data.timestamp) : new Date();
      // Soil sensors may send digital 0/1 or percent
      let value = null;
      let unit = null;
      if (typeof data.soil_moisture_digital !== 'undefined') {
        value = Number(data.soil_moisture_digital);
        unit = 'digital';
      } else if (typeof data.percent !== 'undefined') {
        value = isNaN(Number(data.percent)) ? null : Number(data.percent);
        unit = '%';
      } else if (typeof data.value !== 'undefined') {
        // fallback
        value = isNaN(Number(data.value)) ? null : Number(data.value);
        unit = null;
      }

      const reading = new SensorReading({
        type: 'soil',
        value,
        unit,
        description: data.state || null,
        location: data.location || null,
        device: data.device || null,
        pin: data.pin || null,
        connected: typeof data.connected === 'boolean' ? data.connected : null,
        timestamp,
      });

      if (reading.value === null) {
        console.log('Humedad de suelo inválida, no se guarda:', data);
        return;
      }

      await reading.save();
      console.log('Registro de humedad de suelo guardado:', reading._id);
    } catch (error) {
      console.error("Error procesando humedad de suelo:", error);
    }
  }

  async processMotion(data) {
    if (data.motion === true || data.motion === "detected") {
      const reading = new SensorReading({
        type: "motion",
        value: "detected",
        description: "Sensor PIR",
        status: true,
        location: data.location || "exterior",
      });
      await reading.save();
      console.log("Registro de movimiento guardado:", data);
    }
  }

  publishMessage(topic, message) {
    return new Promise((resolve, reject) => {
      if (!this.isConnected) {
        reject(new Error("MQTT client not connected"));
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
