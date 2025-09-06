const mqtt = require("mqtt");
const SensorReading = require("../models/SensorReading");

function sanitizeReading(doc) {
  if (!doc) return null;
  const obj = typeof doc.toObject === "function" ? doc.toObject() : doc;
  const safeDateToISOString = (d) => {
    if (!d) return undefined;
    const dt = new Date(d);
    return !isNaN(dt.getTime()) ? dt.toISOString() : undefined;
  };
  const out = {
    id: obj._id ? String(obj._id) : undefined,
    type: obj.type,
    value: obj.value !== undefined && obj.value !== null ? obj.value : undefined,
    timestamp: safeDateToISOString(obj.timestamp),
    deviceTimestamp: safeDateToISOString(obj.deviceTimestamp),
    unit: obj.unit || undefined,
    description: obj.description || undefined,
    status: typeof obj.status === "boolean" ? obj.status : undefined,
    color: obj.color || undefined,
    location: obj.location || undefined,
    connected: typeof obj.connected === "boolean" ? obj.connected : undefined,
    pin: obj.pin || undefined,
    device: obj.device || undefined,
  };
  Object.keys(out).forEach((k) => out[k] === undefined && delete out[k]);
  return out;
}

class MQTTService {
  constructor() {
    this.client = null;
    this.client2 = null;
    this.isConnected = false;
    // Ventilador
    this.fanAlreadyOn = false;
    this.lastFanOnTs = 0;
    this.lastFanChangeTs = 0;
    // Bomba
    this.pumpOn = false;
    this.lastPumpChangeTs = 0;
    this.lastPumpRecordedState = null;
    this.pumpAutoEnabled = process.env.PUMP_AUTO_ENABLED !== 'false';
    this.pumpDryThreshold = Number(process.env.PUMP_DRY_THRESHOLD || 30);
    this.pumpWetThreshold = Number(process.env.PUMP_WET_THRESHOLD || 40);
    if (this.pumpWetThreshold <= this.pumpDryThreshold) {
      this.pumpWetThreshold = this.pumpDryThreshold + 5;
    }
    this.pumpDigitalDryValue = Number(process.env.PUMP_DIGITAL_DRY || 0);
    this.minPumpOnMs = Number(process.env.MIN_PUMP_ON_MS || 10000);
    this.minPumpChangeIntervalMs = Number(process.env.MIN_PUMP_CHANGE_INTERVAL_MS || 5000);
  }

  getPumpAutoConfig() {
    return {
      enabled: this.pumpAutoEnabled,
      dryThreshold: this.pumpDryThreshold,
      wetThreshold: this.pumpWetThreshold,
      digitalDryValue: this.pumpDigitalDryValue,
      minPumpOnMs: this.minPumpOnMs,
      minPumpChangeIntervalMs: this.minPumpChangeIntervalMs,
      currentState: this.pumpOn ? 'on' : 'off'
    };
  }

  setPumpAutoConfig(cfg = {}) {
    if (typeof cfg.enabled === 'boolean') this.pumpAutoEnabled = cfg.enabled;
    if (typeof cfg.dryThreshold === 'number' && !isNaN(cfg.dryThreshold)) this.pumpDryThreshold = cfg.dryThreshold;
    if (typeof cfg.wetThreshold === 'number' && !isNaN(cfg.wetThreshold)) this.pumpWetThreshold = cfg.wetThreshold;
    if (typeof cfg.digitalDryValue === 'number' && !isNaN(cfg.digitalDryValue)) this.pumpDigitalDryValue = cfg.digitalDryValue;
    if (typeof cfg.minPumpOnMs === 'number' && !isNaN(cfg.minPumpOnMs)) this.minPumpOnMs = cfg.minPumpOnMs;
    if (typeof cfg.minPumpChangeIntervalMs === 'number' && !isNaN(cfg.minPumpChangeIntervalMs)) this.minPumpChangeIntervalMs = cfg.minPumpChangeIntervalMs;
    if (this.pumpWetThreshold <= this.pumpDryThreshold) this.pumpWetThreshold = this.pumpDryThreshold + 1;
    return this.getPumpAutoConfig();
  }

  connect() {
    const baseOptions = {
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

    const host1 = process.env.MQTT_HOST;
    const host2 = process.env.MQTT_HOST2;

    const primaryTopics = [
      "/temperatura",
      "/humedad_aire",
      "/humedad_suelo",
      "/fan",
  "/pump",
  "/pump/status"
    ];
    const secondaryTopics = [
      "/illumination",
      "/entrance",
      "/alerts",
      "/motion",
      "/door/status",
    ];

    // Connect primary client (host1)
    if (host1) {
      const opts1 = Object.assign({ host: host1 }, baseOptions);
      this.client = mqtt.connect(opts1);

      this.client.on("connect", () => {
        console.log("Conectado a MQTT broker (primary):", host1);
        this.isConnected = true;
        // suscribir tópicos primarios
        primaryTopics.forEach((t) => this.client.subscribe(t, { qos: 0 }));
      });

      this.client.on("message", async (topic, message) => {
        console.log(`Mensaje recibido en ${topic}:`, message.toString());
        await this.processMessage(topic, message.toString());
      });

      this.client.on("error", (error) => {
        console.error("Error en MQTT primary:", error);
      });

      this.client.on("offline", () => {
        console.log("MQTT primary offline");
      });
    }

    // Connect secondary client (host2) if provided
    if (host2) {
      const opts2 = Object.assign({ host: host2 }, baseOptions);
      this.client2 = mqtt.connect(opts2);

      this.client2.on("connect", () => {
        console.log("Conectado a MQTT broker (secondary):", host2);
        this.isConnected = true;
        // suscribir tópicos secundarios
        secondaryTopics.forEach((t) => this.client2.subscribe(t, { qos: 0 }));
      });

      this.client2.on("message", async (topic, message) => {
        console.log(`Mensaje recibido en ${topic}:`, message.toString());
        await this.processMessage(topic, message.toString());
      });

      this.client2.on("error", (error) => {
        console.error("Error en MQTT secondary:", error);
      });

      this.client2.on("offline", () => {
        console.log("MQTT secondary offline");
      });
    }
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
        case "/door/status":
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
        case "/fan":
          // Actualizar estado simple si algún otro componente envía estado
          if (data && typeof data.state === "string") {
            this.fanAlreadyOn = data.state.toLowerCase() === "on";
          }
          break;
        case "/pump":
        case "/pump/status":
          await this.processPump(data);
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
    if (global && typeof global.emitUpdate === "function")
      global.emitUpdate("sensor_update", sanitizeReading(reading));
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
    if (global && typeof global.emitUpdate === "function")
      global.emitUpdate("sensor_update", sanitizeReading(reading));
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
    if (global && typeof global.emitUpdate === "function")
      global.emitUpdate("sensor_update", sanitizeReading(reading));
    console.log("Registro de alerta guardado:", data);
  }

  async processTemperature(data) {
    const deviceTs = data.timestamp ? new Date(data.timestamp) : null;
    const timestamp = new Date(); 
    const reading = new SensorReading({
      type: "temperature",
      value: isNaN(Number(data.temperature)) ? null : Number(data.temperature),
      unit: "°C",
      description:
        data.description ||
        `Lectura ${data.device || "DHT"} en ${data.location || "interior"}`,
      location: data.location || "interior",
      device: data.device || null,
      deviceTimestamp: deviceTs,
      timestamp,
      pin: data.pin || null,
      connected: typeof data.connected === "boolean" ? data.connected : null,
    });
    // avoid saving entries with null value for temperature
    if (reading.value === null) {
      console.log("Temperatura inválida, no se guarda:", data);
      return;
    }
    await reading.save();
    if (global && typeof global.emitUpdate === "function")
      global.emitUpdate("sensor_update", sanitizeReading(reading));
    console.log("Registro de temperatura guardado:", reading._id);

    try {
      const threshold = 20; 
      if (reading.value >= threshold) {
        const now = Date.now();
        if (!this.fanAlreadyOn || now - this.lastFanOnTs > 5000) {
          await this.publishMessage("/fan", { state: "on", source: "backend", reason: `temp>=${threshold}` });
          this.fanAlreadyOn = true;
          this.lastFanOnTs = now;
          this.lastFanChangeTs = now;
          console.log(`Ventilador activado por temperatura (${reading.value}°C >= ${threshold}°C)`);

          try {
            const fanAction = new SensorReading({
              type: 'fan',
              value: 'on',
              status: true,
              description: 'Ventilador encendido por temperatura',
              location: reading.location || 'interior',
              device: 'fan_auto_temp'
            });
            await fanAction.save();
            if (global && typeof global.emitUpdate === 'function') {
              global.emitUpdate('sensor_update', sanitizeReading(fanAction));
            }
          } catch (err) {
            console.error('Error guardando acción de ventilador:', err);
          }
        }
      } else {
        const offThreshold = threshold - 1; // 19°C para pruebas
        if (this.fanAlreadyOn && reading.value <= offThreshold) {
          const now = Date.now();
          if (now - this.lastFanChangeTs > 5000) { // anti-spam 5s
            try {
              await this.publishMessage("/fan", { state: "off", source: "backend", reason: `temp<=${offThreshold}` });
              this.fanAlreadyOn = false;
              this.lastFanChangeTs = now;
              console.log(`Ventilador apagado por temperatura (${reading.value}°C <= ${offThreshold}°C)`);
              const fanOffAction = new SensorReading({
                type: 'fan',
                value: 'off',
                status: false,
                description: 'Ventilador apagado por temperatura',
                location: reading.location || 'interior',
                device: 'fan_auto_temp'
              });
              await fanOffAction.save();
              if (global && typeof global.emitUpdate === 'function') {
                global.emitUpdate('sensor_update', sanitizeReading(fanOffAction));
              }
            } catch (err) {
              console.error('Error guardando acción de apagado de ventilador:', err);
            }
          }
        }
      }
    } catch (e) {
      console.error("Error en lógica simple de ventilador:", e);
    }
  }

  async processHumidity(data) {
    const deviceTs = data.timestamp ? new Date(data.timestamp) : null;
    const timestamp = new Date();
    const reading = new SensorReading({
      type: "humidity",
      value: isNaN(Number(data.humidity)) ? null : Number(data.humidity),
      unit: "%",
      description:
        data.description ||
        `Lectura ${data.device || "DHT"} en ${data.location || "interior"}`,
      location: data.location || "interior",
      device: data.device || null,
      deviceTimestamp: deviceTs,
      timestamp,
      pin: data.pin || null,
      connected: typeof data.connected === "boolean" ? data.connected : null,
    });
    if (reading.value === null) {
      console.log("Humedad inválida, no se guarda:", data);
      return;
    }
    await reading.save();
    if (global && typeof global.emitUpdate === "function")
      global.emitUpdate("sensor_update", sanitizeReading(reading));
    console.log("Registro de humedad guardado:", reading._id);
  }

  async processSoil(data) {
    try {
      if (typeof data.connected === "boolean" && data.connected === false) {
        console.log(
          "Lectura de humedad de suelo ignorada: sensor no conectado"
        );
        return;
      }
      const timestamp = data.timestamp ? new Date(data.timestamp) : new Date();
      // Soil sensors may send digital 0/1 or percent
      let value = null;
      let unit = null;
      if (typeof data.soil_moisture_digital !== "undefined") {
        value = Number(data.soil_moisture_digital);
        unit = "digital";
      } else if (typeof data.percent !== "undefined") {
        value = isNaN(Number(data.percent)) ? null : Number(data.percent);
        unit = "%";
      } else if (typeof data.value !== "undefined") {
        // fallback
        value = isNaN(Number(data.value)) ? null : Number(data.value);
        unit = null;
      }

      const reading = new SensorReading({
        type: "soil",
        value,
        unit,
        description: data.state || null,
        location: data.location || null,
        device: data.device || null,
        pin: data.pin || null,
        connected: typeof data.connected === "boolean" ? data.connected : null,
        timestamp,
      });

      if (reading.value === null) {
        console.log("Humedad de suelo inválida, no se guarda:", data);
        return;
      }

      await reading.save();
      if (global && typeof global.emitUpdate === "function")
        global.emitUpdate("sensor_update", sanitizeReading(reading));
      console.log("Registro de humedad de suelo guardado:", reading._id);

      // Evaluar control automático de bomba
      try {
        await this.evaluatePumpAuto({ value: reading.value, unit: reading.unit });
      } catch (e) {
        console.error('Error evaluando bomba automática:', e);
      }
    } catch (error) {
      console.error("Error procesando humedad de suelo:", error);
    }
  }

  async processPump(data) {
    try {
      const raw = data.state || data.value || data.pump;
      if (!raw) return;
      const st = String(raw).toLowerCase();
      if (!['on','off','true','false','1','0'].includes(st)) return;
      const isOn = ['on','true','1'].includes(st);

      // Evitar registrar duplicados si estado no cambia
      if (this.lastPumpRecordedState === (isOn ? 'on' : 'off')) return;
      this.lastPumpRecordedState = isOn ? 'on' : 'off';
      this.pumpOn = isOn;
      this.lastPumpChangeTs = Date.now();

      const reading = new SensorReading({
        type: 'pump',
        value: isOn ? 'on' : 'off',
        status: isOn,
        description: isOn ? 'Bomba activada' : 'Bomba desactivada',
        location: data.location || 'garden',
        device: data.device || (data.source ? `pump_${data.source}` : 'water_pump')
      });
      await reading.save();
      if (global && typeof global.emitUpdate === 'function') {
        global.emitUpdate('sensor_update', sanitizeReading(reading));
      }
      console.log('Registro de bomba guardado:', reading.value);
    } catch (e) {
      console.error('Error procesando/registrando bomba:', e);
    }
  }

  async evaluatePumpAuto({ value, unit }) {
    if (!this.pumpAutoEnabled) return;
    if (typeof value !== 'number' || isNaN(value)) return;

    const now = Date.now();
    const sinceLast = now - this.lastPumpChangeTs;

    let shouldOn = false;
    let shouldOff = false;

    if (unit === '%') {
      if (!this.pumpOn && value <= this.pumpDryThreshold) shouldOn = true;
      if (this.pumpOn && value >= this.pumpWetThreshold) shouldOff = true;
    } else if (unit === 'digital') {
      // digitalDryValue representa estado seco -> encender
      if (!this.pumpOn && value === this.pumpDigitalDryValue) shouldOn = true;
      if (this.pumpOn && value !== this.pumpDigitalDryValue) shouldOff = true;
    } else {
      // Si no hay unidad, intentar heurística: valores bajos = seco (<=dry threshold)
      if (!this.pumpOn && value <= this.pumpDryThreshold) shouldOn = true;
      if (this.pumpOn && value >= this.pumpWetThreshold) shouldOff = true;
    }

    // Anti-spam cambios muy seguidos
    if (sinceLast < this.minPumpChangeIntervalMs) return;

    // Garantizar tiempo mínimo de encendido antes de apagar
    if (shouldOff && this.pumpOn && sinceLast < this.minPumpOnMs) {
      return;
    }

    if (shouldOn) {
      await this.publishMessage('/pump', { state: 'on', source: 'auto_soil', value, unit });
      // processPump se encargará de registrar al recibirse (si llega loopback). Si no, registrar directo fallback:
      if (this.lastPumpRecordedState !== 'on') {
        await this.processPump({ state: 'on', source: 'auto_soil', value, unit });
      }
    } else if (shouldOff) {
      await this.publishMessage('/pump', { state: 'off', source: 'auto_soil', value, unit });
      if (this.lastPumpRecordedState !== 'off') {
        await this.processPump({ state: 'off', source: 'auto_soil', value, unit });
      }
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
      if (global && typeof global.emitUpdate === "function")
        global.emitUpdate("sensor_update", sanitizeReading(reading));
      console.log("Registro de movimiento guardado:", data);
    }
  }

  publishMessage(topic, message) {
    return new Promise((resolve, reject) => {
      const primaryTopicsSet = new Set([
        "/temperatura",
        "/humedad_aire",
        "/humedad_suelo",
        "/fan",
  "/pump"
      ]);
      const clientToUse = primaryTopicsSet.has(topic)
        ? this.client || this.client2
        : this.client2 || this.client;

      if (!clientToUse) {
        reject(new Error("No MQTT client available to publish"));
        return;
      }

      clientToUse.publish(topic, JSON.stringify(message), (error) => {
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
