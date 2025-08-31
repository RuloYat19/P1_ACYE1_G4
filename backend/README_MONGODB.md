# Sistema de Monitoreo IoT con MongoDB (ClusterArqui)

## 📋 Funcionalidades Implementadas

### 🔧 **Backend Mejorado**
- ✅ Clase `MongoDBConnection` robusta con manejo de errores y reconexión
- ✅ Índices optimizados para consultas rápidas
- ✅ Validación de datos de entrada
- ✅ Cálculo automático de índice de calor
- ✅ Change streams para tiempo real
- ✅ API REST completa
- ✅ WebSockets con Socket.IO

### 🌐 **API Endpoints**

#### **Lecturas de Sensores**
```
GET /api/readings              # Todas las lecturas (paginado)
GET /api/readings/latest       # Última lectura
GET /api/readings/stats        # Estadísticas generales
GET /api/readings/aggregate    # Datos agregados por tiempo
POST /api/readings             # Insertar nueva lectura
GET /api/readings/health       # Health check
```

#### **Parámetros de Consulta**
```
/api/readings?page=1&limit=50&device_id=ARQUI_001&from=2024-01-01&to=2024-01-02
/api/readings/aggregate?from=2024-01-01T00:00:00Z&to=2024-01-02T00:00:00Z&group=hour
```

### 🔄 **WebSockets en Tiempo Real**
```javascript
// Eventos emitidos por el servidor
socket.on('newReading', (data) => {
  console.log('Nueva lectura:', data);
});

socket.on('readings:new', (data) => {
  console.log('Nuevo formato:', data);
});

// Eventos que puede enviar el cliente
socket.emit('requestLatest'); // Solicitar última lectura
socket.emit('joinDevice', 'ARQUI_001'); // Unirse a updates de dispositivo específico
```

## 🚀 **Cómo Usar**

### **1. Configuración**
```bash
# Variables de entorno (.env)
PORT=3001
MONGO_URI=mongodb+srv://homepi:homepi@clusterarqui.ugufg7b.mongodb.net/?retryWrites=true&w=majority&appName=ClusterArqui
MONGO_DB=arqui
CORS_ORIGIN=http://localhost:5173
```

### **2. Ejecutar el Servidor**
```bash
cd backend
npm run dev    # Desarrollo con nodemon
npm start      # Producción
```

### **3. Probar con Datos de Ejemplo**
```bash
# Insertar datos de prueba una vez
node test-insert.js

# Generar datos continuos cada 10 segundos
node test-insert.js continuous 10
```

### **4. Estructura de Datos**
```javascript
// Lectura de sensor en colección Arqui.Arqui
{
  "_id": "ObjectId",
  "temperature": 22.5,
  "humidity": 65.3,
  "device_id": "ARQUI_001",
  "sensor_type": "ARQUI",
  "heat_index": 21.8,
  "timestamp": "2024-01-01T12:00:00.000Z",
  "created_at": "2024-01-01T12:00:00.000Z"
}
```

## 📊 **Ejemplos de Uso**

### **Insertar Lectura desde JavaScript**
```javascript
const response = await fetch('/api/readings', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    temperature: 25.5,
    humidity: 60.2,
    device_id: 'ARQUI_001'
  })
});
```

### **Obtener Estadísticas**
```javascript
const stats = await fetch('/api/readings/stats');
const data = await stats.json();
// { avgTemperature: 22.5, avgHumidity: 65.0, count: 1000, ... }
```

### **Conectar WebSocket**
```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:3001');

socket.on('connect', () => {
  console.log('Conectado al servidor');
});

socket.on('newReading', (reading) => {
  console.log('Nueva lectura:', reading);
  // Actualizar UI en tiempo real
});
```

## 🏗️ **Arquitectura del Sistema - ClusterArqui**

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────────┐
│   Frontend      │◄──►│    Backend       │◄──►│  MongoDB Atlas      │
│   (React/Vue)   │    │    (Node.js)     │    │  (ClusterArqui)     │
└─────────────────┘    └──────────────────┘    └─────────────────────┘
                              │                        │
                              ▼                        │
                       ┌──────────────┐               │
                       │  Socket.IO   │               │
                       │ (Tiempo Real)│               │
                       └──────────────┘               │
                                                      │
                              Base de Datos: Arqui     │
                              Colección: Arqui ────────┘
```

### **Componentes Principales**
- **`mongo.js`** - Conexión y configuración de MongoDB
- **`readingsService.js`** - Lógica de negocio para sensores
- **`readings.js`** - Rutas de la API REST
- **`sockets/`** - WebSockets y change streams
- **`test-insert.js`** - Script de pruebas

## 🔍 **Índices Optimizados - Colección Arqui**
```javascript
// Automáticamente creados al conectar a Arqui.Arqui
{ timestamp: -1 }                    // Consultas por fecha
{ device_id: 1, timestamp: -1 }      // Por dispositivo y fecha
{ temperature: 1 }                   // Filtros por temperatura
{ humidity: 1 }                      // Filtros por humedad
```

## 🛠️ **Funciones de Control**

### **Validación de Datos**
- ✅ Tipos de datos correctos
- ✅ Rangos razonables (-50°C a 100°C, 0-100% humedad)
- ✅ Campos requeridos

### **Manejo de Errores**
- ✅ Reconexión automática
- ✅ Logging detallado
- ✅ Respuestas HTTP apropiadas
- ✅ Validación de entrada

### **Performance**
- ✅ Índices optimizados
- ✅ Paginación en consultas
- ✅ Connection pooling
- ✅ Change streams eficientes

## 🎯 **Casos de Uso Comunes**

1. **Dashboard en Tiempo Real** - WebSockets + última lectura
2. **Análisis Histórico** - API agregada por hora/día
3. **Monitoreo por Dispositivo** - Filtros por device_id
4. **Alertas** - Validación de rangos + WebSockets
5. **Reportes** - Estadísticas y datos agregados

## 🚨 **Monitoreo y Debugging**

### **Health Checks**
```bash
curl http://localhost:3001/health
curl http://localhost:3001/api/readings/health
```

### **Logs del Sistema**
```
[MongoDB] ✅ Conectado exitosamente a: arqui
[MongoDB] Índice creado en arqui: { timestamp: -1 }
[Socket] Cliente conectado: abc123
[ChangeStream] Nueva lectura detectada en Arqui.Arqui
[API] Error listando lecturas: ValidationError
```

¡El sistema está listo para manejar datos de sensores IoT en ClusterArqui de manera robusta y escalable! 🎉
