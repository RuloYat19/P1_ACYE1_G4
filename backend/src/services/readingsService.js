import { getDB } from '../db/mongo.js';

/**
 * Servicio mejorado para manejar operaciones de lecturas de sensores DHT11
 */
class ReadingsService {
  constructor() {
    this.collectionName = 'dht11_readings';
  }

  /**
   * Obtiene la colección de lecturas
   */
  getCollection() {
    const db = getDB();
    return db.collection(this.collectionName);
  }

  /**
   * Obtener todas las lecturas con paginación - Compatible con API existente
   */
  async listReadings({ page = 1, limit = 50, from, to, type = 'DHT', device_id } = {}) {
    try {
      const collection = this.getCollection();
      const skip = (page - 1) * limit;
      
      // Construir query
      const query = {};
      
      // Filtro por fechas
      if (from || to) {
        query.timestamp = {};
        if (from) query.timestamp.$gte = new Date(from);
        if (to) query.timestamp.$lte = new Date(to);
      }
      
      // Filtro por dispositivo
      if (device_id) {
        query.device_id = device_id;
      }
      
      // type reservado para expansión futura
      if (type && type !== 'DHT') {
        query.sensor_type = type;
      }
      
      const readings = await collection
        .find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .toArray();
      
      const total = await collection.countDocuments(query);
      
      return {
        data: readings,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      console.error('[ReadingsService] Error obteniendo lecturas:', error);
      throw new Error('Error obteniendo lecturas de la base de datos');
    }
  }

  /**
   * Obtener la lectura más reciente - Compatible con API existente
   */
  async latestReading() {
    try {
      const collection = this.getCollection();
      const latest = await collection
        .findOne({}, { sort: { timestamp: -1 } });
      return latest;
    } catch (error) {
      console.error('[ReadingsService] Error obteniendo última lectura:', error);
      throw new Error('Error obteniendo la última lectura');
    }
  }

  /**
   * Agregaciones para estadísticas - Compatible con API existente
   */
  async aggregateReadings({ from, to, group = 'hour' }) {
    try {
      const collection = this.getCollection();
      
      const match = {
        timestamp: {
          $gte: new Date(from),
          $lte: new Date(to)
        }
      };

      let groupBy;
      switch (group) {
        case 'minute':
          groupBy = {
            year: { $year: "$timestamp" },
            month: { $month: "$timestamp" },
            day: { $dayOfMonth: "$timestamp" },
            hour: { $hour: "$timestamp" },
            minute: { $minute: "$timestamp" }
          };
          break;
        case 'hour':
          groupBy = {
            year: { $year: "$timestamp" },
            month: { $month: "$timestamp" },
            day: { $dayOfMonth: "$timestamp" },
            hour: { $hour: "$timestamp" }
          };
          break;
        case 'day':
          groupBy = {
            year: { $year: "$timestamp" },
            month: { $month: "$timestamp" },
            day: { $dayOfMonth: "$timestamp" }
          };
          break;
        default:
          groupBy = {
            year: { $year: "$timestamp" },
            month: { $month: "$timestamp" },
            day: { $dayOfMonth: "$timestamp" },
            hour: { $hour: "$timestamp" }
          };
      }

      const pipeline = [
        { $match: match },
        {
          $group: {
            _id: groupBy,
            avgTemperature: { $avg: "$temperature" },
            avgHumidity: { $avg: "$humidity" },
            maxTemperature: { $max: "$temperature" },
            minTemperature: { $min: "$temperature" },
            maxHumidity: { $max: "$humidity" },
            minHumidity: { $min: "$humidity" },
            count: { $sum: 1 },
            timestamp: { $first: "$timestamp" }
          }
        },
        { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1, "_id.hour": 1, "_id.minute": 1 } }
      ];

      const result = await collection.aggregate(pipeline).toArray();
      return result;
    } catch (error) {
      console.error('[ReadingsService] Error en agregación:', error);
      throw new Error('Error obteniendo datos agregados');
    }
  }

  /**
   * Obtener estadísticas generales - Nueva funcionalidad del código anterior
   */
  async getStats() {
    try {
      const collection = this.getCollection();
      
      const stats = await collection.aggregate([
        {
          $group: {
            _id: null,
            avgTemperature: { $avg: "$temperature" },
            avgHumidity: { $avg: "$humidity" },
            maxTemperature: { $max: "$temperature" },
            minTemperature: { $min: "$temperature" },
            maxHumidity: { $max: "$humidity" },
            minHumidity: { $min: "$humidity" },
            count: { $sum: 1 }
          }
        }
      ]).toArray();
      
      return stats[0] || {
        avgTemperature: 0,
        avgHumidity: 0,
        maxTemperature: 0,
        minTemperature: 0,
        maxHumidity: 0,
        minHumidity: 0,
        count: 0
      };
    } catch (error) {
      console.error('[ReadingsService] Error obteniendo estadísticas:', error);
      throw new Error('Error obteniendo estadísticas');
    }
  }

  /**
   * Insertar una nueva lectura
   */
  async insertReading(reading) {
    try {
      const collection = this.getCollection();
      
      // Validar datos
      const validatedReading = this.validateReading(reading);
      
      const result = await collection.insertOne({
        ...validatedReading,
        timestamp: new Date(),
        created_at: new Date()
      });
      
      console.log('[ReadingsService] Nueva lectura insertada:', result.insertedId);
      return result;
    } catch (error) {
      console.error('[ReadingsService] Error insertando lectura:', error);
      throw new Error('Error insertando nueva lectura');
    }
  }

  /**
   * Validar datos de lectura
   */
  validateReading(reading) {
    const { temperature, humidity, device_id = 'default' } = reading;
    
    if (typeof temperature !== 'number' || isNaN(temperature)) {
      throw new Error('Temperatura debe ser un número válido');
    }
    
    if (typeof humidity !== 'number' || isNaN(humidity)) {
      throw new Error('Humedad debe ser un número válido');
    }
    
    // Validar rangos razonables
    if (temperature < -50 || temperature > 100) {
      throw new Error('Temperatura fuera de rango válido (-50°C a 100°C)');
    }
    
    if (humidity < 0 || humidity > 100) {
      throw new Error('Humedad fuera de rango válido (0% a 100%)');
    }
    
    return {
      temperature: parseFloat(temperature.toFixed(2)),
      humidity: parseFloat(humidity.toFixed(2)),
      device_id,
      sensor_type: 'DHT11',
      // Calcular índice de calor si es necesario
      heat_index: this.calculateHeatIndex(temperature, humidity)
    };
  }

  /**
   * Calcular índice de calor
   */
  calculateHeatIndex(temperature, humidity) {
    // Convertir Celsius a Fahrenheit para el cálculo
    const tempF = (temperature * 9/5) + 32;
    
    // Fórmula simplificada del heat index
    const hi = 0.5 * (tempF + 61.0 + ((tempF - 68.0) * 1.2) + (humidity * 0.094));
    
    // Convertir de vuelta a Celsius
    return parseFloat(((hi - 32) * 5/9).toFixed(2));
  }

  /**
   * Configurar change stream para monitorear cambios en tiempo real
   */
  watchChanges(callback) {
    try {
      const collection = this.getCollection();
      const changeStream = collection.watch([
        { $match: { operationType: 'insert' } }
      ]);
      
      changeStream.on('change', async (change) => {
        console.log('[ReadingsService] Nuevo documento insertado');
        try {
          const latestReading = await this.latestReading();
          callback(latestReading);
        } catch (error) {
          console.error('[ReadingsService] Error en change stream:', error);
        }
      });
      
      changeStream.on('error', (error) => {
        console.error('[ReadingsService] Error en change stream:', error);
      });
      
      console.log('[ReadingsService] Change stream configurado');
      return changeStream;
    } catch (error) {
      console.error('[ReadingsService] Error configurando change stream:', error);
      throw error;
    }
  }
}

// Instancia singleton
const readingsService = new ReadingsService();

// Exportar funciones compatibles con la API existente
export const listReadings = (options) => readingsService.listReadings(options);
export const latestReading = () => readingsService.latestReading();
export const aggregateReadings = (options) => readingsService.aggregateReadings(options);

// Exportar nuevas funcionalidades
export const getStats = () => readingsService.getStats();
export const insertReading = (reading) => readingsService.insertReading(reading);
export const watchChanges = (callback) => readingsService.watchChanges(callback);

// Exportar la instancia para uso avanzado
export default readingsService;
