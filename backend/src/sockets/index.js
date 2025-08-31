import { Server } from 'socket.io';
import { watchDhtCollection } from './watchers.js';
import { latestReading } from '../services/readingsService.js';

export function initSockets(httpServer, db) {
  const io = new Server(httpServer, { 
    cors: { 
      origin: process.env.CORS_ORIGIN || '*',
      methods: ["GET", "POST"]
    } 
  });

  io.on('connection', async (socket) => {
    console.log('[Socket] Cliente conectado:', socket.id);
    
    // Enviar la última lectura al conectarse
    try {
      const latest = await latestReading();
      if (latest) {
        socket.emit('newReading', latest);
        console.log('[Socket] Última lectura enviada al cliente:', socket.id);
      }
    } catch (error) {
      console.error('[Socket] Error enviando última lectura:', error);
    }
    
    socket.on('disconnect', () => {
      console.log('[Socket] Cliente desconectado:', socket.id);
    });

    // Manejar solicitudes de datos específicos
    socket.on('requestLatest', async () => {
      try {
        const latest = await latestReading();
        socket.emit('newReading', latest);
      } catch (error) {
        console.error('[Socket] Error en requestLatest:', error);
        socket.emit('error', { message: 'Error obteniendo última lectura' });
      }
    });

    // Unirse a salas por device_id para filtros específicos
    socket.on('joinDevice', (deviceId) => {
      socket.join(`device_${deviceId}`);
      console.log(`[Socket] Cliente ${socket.id} se unió a device_${deviceId}`);
    });

    socket.on('leaveDevice', (deviceId) => {
      socket.leave(`device_${deviceId}`);
      console.log(`[Socket] Cliente ${socket.id} dejó device_${deviceId}`);
    });
  });

  // Configurar el monitoring de cambios en la base de datos
  watchDhtCollection(db, io);
  
  return io;
}
