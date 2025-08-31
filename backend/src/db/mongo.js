// IMPORT MONGO
import dotenv from "dotenv";
dotenv.config();
import { MongoClient } from "mongodb";
// IMPORT SOCKET.io | EXPRESS

import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';

const app = express();
const server = http.createServer(app);

const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST"]
  }
});

const uri = process.env.MONGO_URI;
console.log("MONGO_URI:", uri);
const client = new MongoClient(uri);

let db, collection_sensores;

// Conexión
async function conectarMONGO() {
  try {
    await client.connect();
    console.log("✅ Conectado a MongoDB");

  db = client.db(process.env.MONGO_DB);  // Base de datos
  collection_sensores = db.collection(process.env.MONGO_COLLECTION_SENSORES); // Colección

  } catch (err) {
    console.error("❌ Error conectando a MongoDB:", err);
  }
}


// Insertar lectura
async function insertarRegistro(reading) {
  try {
    const result = await collection_sensores.insertOne({
      ...reading,
      timestamp: new Date()
    });
    console.log("📥 Insertado:", result.insertedId);
    return result;
  } catch (err) {
    console.error("❌ Error insertando lectura:", err);
  }
}

// Función para monitorear cambios en tiempo real
// COLECCIÓN SENSORES  |  Registros_Sensores
function verCambios() {
  const changeStream = collection_sensores.watch();

  changeStream.on('change', async (change) => {
    if (change.operationType === 'insert') {
      // Emitir el nuevo dato a todos los clientes conectados
      const latestData = await ultimoRegistro();
      io.emit('newReading', latestData);
    }
  });
}

// Obtener la última lectura
async function ultimoRegistro() {
  try {
    const ultimo = await collection_sensores.findOne({}, { sort: { timestamp: -1 } });
    return ultimo;
  } catch (error) {
    console.error("Error al obtener la última lectura:", error);
    return null;
  }
}

// ============================================================
//                            API's
// ============================================================

// Obtener datos de MONGO
app.get('/api/lecturas', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    
    const readings = await collection
      .find({})
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    const total = await collection_sensores.countDocuments();

    res.json({
      data: readings,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error obteniendo lecturas:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Obtener la lectura más reciente
app.get('/api/lecturas/reciente', async (req, res) => {
  try {
    const ultimo = await ultimoRegistro();
    res.json(ultimo);
  } catch (error) {
    console.error('Error obteniendo última lectura:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Obtener estadísticas
app.get('/api/estadisticas', async (req, res) => {
  try {
    const stats = await collection_sensores.aggregate([
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
    
    res.json(stats[0] || {});
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Conexión de Socket.IO
io.on('connection', (socket) => {
  console.log('Cliente conectado:', socket.id);
  
  // Enviar la última lectura al conectarse
  ultimoRegistro().then(ultimo => {
    if (ultimo) {
      socket.emit('newReading', ultimo);
    }
  });
  
  socket.on('disconnect', () => {
    console.log('Cliente desconectado:', socket.id);
  });
});

const PORT = process.env.PORT || 3001;

conectarMONGO().then(() => {
  server.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
  });
});

// ============================================================

// Cerrar conexión
async function cerrarMONGO() {
  await client.close();
  console.log("🔒 Conexión cerrada");
}

export { conectarMONGO, insertarRegistro, ultimoRegistro, cerrarMONGO };
