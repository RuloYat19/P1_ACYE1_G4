import { latestReading } from '../services/readingsService.js';

export function watchDhtCollection(db, io) {
  const changeStream = db.collection('arqui').watch(
    [
      { $match: { operationType: 'insert' } }
    ], 
    { fullDocument: 'updateLookup' }
  );
  
  changeStream.on('change', async (change) => {
    try {
      if (change.operationType === 'insert') {
        console.log('[ChangeStream] Nueva lectura detectada');
        
        const latest = await latestReading();
        if (latest) {
          // Emitir a todos los clientes
          io.emit('readings:new', latest);
          io.emit('newReading', latest); // compatibilidad con frontend actual
          
          // Emitir a clientes específicos del dispositivo si existe device_id
          if (latest.device_id) {
            io.to(`device_${latest.device_id}`).emit('deviceReading', latest);
          }
          
          console.log('[ChangeStream] Lectura emitida a clientes:', {
            id: latest._id,
            temperature: latest.temperature,
            humidity: latest.humidity,
            device_id: latest.device_id
          });
        }
      }
    } catch (error) {
      console.error('[ChangeStream] Error procesando cambio:', error);
    }
  });
  
  changeStream.on('error', (err) => {
    console.error('[ChangeStream] Error en stream:', err);
    
    // Intentar reconectar después de un error
    setTimeout(() => {
      console.log('[ChangeStream] Intentando reconectar...');
      watchDhtCollection(db, io);
    }, 5000);
  });
  
  changeStream.on('close', () => {
    console.log('[ChangeStream] Stream cerrado');
  });
  
  console.log('[ChangeStream] Configurado para monitorear colección arqui');
  
  return changeStream;
}
