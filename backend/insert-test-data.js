import 'dotenv/config';
import { MongoClient } from 'mongodb';

// Configuración directa (como tu código original)
const uri = process.env.MONGO_URI;
const client = new MongoClient(uri);

async function insertTestData() {
  try {
    console.log('🚀 Conectando a MongoDB...');
    await client.connect();
    console.log('✅ Conectado exitosamente');

    const db = client.db(process.env.MONGO_DB || "arqui");
    const collection = db.collection("arqui");

    // Datos de prueba
    const testData = [
      { temperature: 22.5, humidity: 65.3, timestamp: new Date() },
      { temperature: 23.1, humidity: 62.8, timestamp: new Date() },
      { temperature: 21.9, humidity: 68.2, timestamp: new Date() },
      { temperature: 24.3, humidity: 59.7, timestamp: new Date() },
      { temperature: 20.8, humidity: 71.4, timestamp: new Date() }
    ];

    console.log('\n📊 Insertando datos de prueba...');
    
    for (let i = 0; i < testData.length; i++) {
      const reading = testData[i];
      console.log(`\nInsertando lectura ${i + 1}/${testData.length}:`);
      console.log(`  🌡️  Temperatura: ${reading.temperature}°C`);
      console.log(`  💧 Humedad: ${reading.humidity}%`);
      
      const result = await collection.insertOne(reading);
      console.log(`  ✅ Insertado con ID: ${result.insertedId}`);
      
      // Esperar 1 segundo entre inserciones
      if (i < testData.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log('\n🎉 Todas las lecturas insertadas correctamente');
    
    // Mostrar estadísticas
    console.log('\n📈 Verificando datos insertados...');
    const total = await collection.countDocuments();
    const latest = await collection.findOne({}, { sort: { timestamp: -1 } });
    
    console.log(`📊 Total de documentos: ${total}`);
    console.log('🕐 Última lectura:', latest);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.close();
    console.log('\n🔌 Conexión cerrada');
  }
}

// Ejecutar
insertTestData();
