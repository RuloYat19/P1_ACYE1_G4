/**
 * Script para probar la inserción de datos y el sistema de tiempo real
 * Ejecutar con: node test-insert.js
 */

import 'dotenv/config';
import { connectMongo, closeMongo } from './src/db/mongo.js';
import { insertReading } from './src/db/mongo.js'; // Usar directamente desde mongo.js

async function testInsertions() {
  try {
    console.log('🚀 Conectando a MongoDB...');
    await connectMongo();
    console.log('✅ Conectado exitosamente');

    // Datos de prueba realistas para sensor DHT11
    const testData = [
      { temperature: 22.5, humidity: 65.3, device_id: 'DHT11_001' },
      { temperature: 23.1, humidity: 62.8, device_id: 'DHT11_001' },
      { temperature: 21.9, humidity: 68.2, device_id: 'DHT11_002' },
      { temperature: 24.3, humidity: 59.7, device_id: 'DHT11_001' },
      { temperature: 20.8, humidity: 71.4, device_id: 'DHT11_002' }
    ];

    console.log('\n📊 Insertando datos de prueba...');
    
    for (let i = 0; i < testData.length; i++) {
      const reading = testData[i];
      console.log(`\nInsertando lectura ${i + 1}/${testData.length}:`);
      console.log(`  🌡️  Temperatura: ${reading.temperature}°C`);
      console.log(`  💧 Humedad: ${reading.humidity}%`);
      console.log(`  📱 Dispositivo: ${reading.device_id}`);
      
      const result = await insertReading(reading);
      console.log(`  ✅ Insertado con ID: ${result.insertedId}`);
      
      // Esperar 2 segundos entre inserciones para ver el efecto en tiempo real
      if (i < testData.length - 1) {
        console.log('  ⏳ Esperando 2 segundos...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    console.log('\n🎉 Todas las lecturas insertadas correctamente');
    console.log('\n💡 Consejos:');
    console.log('   - Si tienes el frontend abierto, deberías ver las lecturas en tiempo real');
    console.log('   - Puedes probar las APIs:');
    console.log('     GET /api/readings/latest');
    console.log('     GET /api/readings/stats');
    console.log('     GET /api/readings?limit=10');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await closeMongo();
    console.log('\n🔌 Conexión cerrada');
  }
}

// Función para generar datos aleatorios continuos
async function generateContinuousData(intervalSeconds = 10) {
  try {
    await connectMongo();
    console.log('🔄 Generando datos cada', intervalSeconds, 'segundos...');
    console.log('🛑 Presiona Ctrl+C para detener');

    const devices = ['DHT11_001', 'DHT11_002', 'DHT11_003'];
    
    const interval = setInterval(async () => {
      try {
        const deviceId = devices[Math.floor(Math.random() * devices.length)];
        const temperature = Math.round((Math.random() * 15 + 18) * 100) / 100; // 18-33°C
        const humidity = Math.round((Math.random() * 40 + 40) * 100) / 100;    // 40-80%
        
        await insertReading({ temperature, humidity, device_id: deviceId });
        
        console.log(`📊 [${new Date().toLocaleTimeString()}] ${deviceId}: ${temperature}°C, ${humidity}%`);
      } catch (error) {
        console.error('Error insertando:', error.message);
      }
    }, intervalSeconds * 1000);

    // Manejar Ctrl+C
    process.on('SIGINT', async () => {
      clearInterval(interval);
      await closeMongo();
      console.log('\n🛑 Generación detenida');
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Ejecutar según argumentos de línea de comandos
const command = process.argv[2];

if (command === 'continuous') {
  const interval = parseInt(process.argv[3]) || 10;
  generateContinuousData(interval);
} else {
  testInsertions();
}
