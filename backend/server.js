const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/database');
const mqttService = require('./services/mqttService');
const sensorRoutes = require('./routes/sensorRoutes');
const actuatorRoutes = require('./routes/actuatorRoutes');

dotenv.config();

const app = express();
const server = http.createServer(app);
const allowedOrigins = (process.env.FRONTEND_URLS || process.env.FRONTEND_URL || 'http://localhost:5173').split(',').map(u => u.trim());

const io = socketIo(server, {
  cors: {
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) !== -1) return callback(null, true);
      const msg = 'El CORS policy no permite el origen: ' + origin;
      return callback(new Error(msg), false);
    },
    methods: ["GET", "POST"],
    credentials: true
  }
});

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) return callback(null, true);
    callback(new Error('CORS origin denied'), false);
  },
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// rutas
app.use('/api/sensors', sensorRoutes);
app.use('/api/actuators', actuatorRoutes);

app.use('*', (req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

app.use((error, req, res, next) => {
  console.error('Error global:', error && error.stack ? error.stack : error);
  const resp = { error: 'Error interno del servidor' };
  if (process.env.NODE_ENV === 'development' && error) {
    resp.details = error.message || String(error);
  }
  res.status(500).json(resp);
});

io.on('connection', (socket) => {
  console.log('Cliente conectado:', socket.id);

  socket.emit('status', {
    message: 'Conectado al servidor',
    timestamp: new Date()
  });

  socket.on('disconnect', () => {
    console.log('Cliente desconectado:', socket.id);
  });

  socket.on('getLatestData', async () => {
    try {
      socket.emit('latestData', {
        message: 'Datos más recientes',
        timestamp: new Date()
      });
    } catch (error) {
      socket.emit('error', { message: 'Error obteniendo datos' });
    }
  });
});

const emitUpdate = (event, data) => {
  io.emit(event, {
    ...data,
    timestamp: new Date()
  });
};

global.emitUpdate = emitUpdate;

const PORT = process.env.PORT || 3001;

const startServer = async () => {
  try {
    await connectDB();
    mqttService.connect();
    server.listen(PORT, () => {
      console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
      console.log(`📱 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
      console.log(`🔗 API URL: http://localhost:${PORT}/api`);
    });
  } catch (error) {
    console.error('Error iniciando el servidor:', error);
    process.exit(1);
  }
};

process.on('SIGINT', async () => {
  console.log('\n🛑 Cerrando servidor...');

  mqttService.disconnect();
  server.close(() => {
    console.log('✅ Servidor cerrado correctamente');
    process.exit(0);
  });
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Recibida señal SIGTERM, cerrando servidor...');
  process.exit(0);
});

startServer();
