# Backend - Sistema Domótico

Backend simplificado para el sistema de domótica con Raspberry Pi, desarrollado con Express.js, MongoDB y MQTT.

## Características

- ✅ API REST para gestión de sensores y actuadores
- ✅ Comunicación MQTT con HiveMQ
- ✅ Base de datos MongoDB en la nube
- ✅ Socket.IO para tiempo real
- ✅ Control de iluminación, puerta, bomba de agua y ventiladores
- ✅ Dashboard con estadísticas y gráficas

## Instalación

1. Instalar dependencias:
```bash
npm install
```

2. Configurar variables de entorno en `.env`:
```env
MONGODB_URI=mongodb+srv://usuario:password@cluster.mongodb.net/dbname
PORT=3001
MQTT_HOST=broker.hivemq.com
MQTT_PORT=1883
FRONTEND_URL=http://localhost:3000
```

3. Iniciar el servidor:
```bash
npm start
# o para desarrollo
npm run dev
```

## API Endpoints

### Sensores
- `GET /api/sensors` - Obtener lecturas con paginación
- `GET /api/sensors/latest` - Obtener última lectura
- `GET /api/sensors/stats` - Estadísticas para dashboard
- `GET /api/sensors/chart?type=temperature&days=7` - Datos para gráficas

### Actuadores
- `POST /api/actuators/light` - Control de iluminación
- `POST /api/actuators/door` - Control de puerta
- `POST /api/actuators/pump` - Control de bomba de agua
- `POST /api/actuators/fan` - Control de ventilador
- `GET /api/actuators/status` - Estado actual de actuadores

## Estructura del Proyecto

```
backend/
├── config/
│   └── database.js          # Conexión MongoDB
├── models/
│   ├── SensorReading.js     # Modelo lecturas
│   └── User.js              # Modelo usuarios
├── routes/
│   ├── sensorRoutes.js      # Rutas sensores
│   └── actuatorRoutes.js    # Rutas actuadores
├── services/
│   └── mqttService.js       # Servicio MQTT
├── .env                     # Variables entorno
├── package.json             # Dependencias
├── server.js                # Punto entrada
└── README.md                # Documentación
```

## Comunicación MQTT

### Temas suscritos:
- `/illumination` - Control de iluminación
- `/entrance` - Control de puerta
- `/alerts` - Sistema de alertas
- `/temperature` - Lecturas de temperatura
- `/humidity` - Lecturas de humedad
- `/motion` - Detección de movimiento

### Temas publicados:
- `/illumination` - Comandos de iluminación
- `/entrance` - Comandos de puerta
- `/pump` - Control de bomba
- `/fan` - Control de ventilador

## Base de Datos

### Colección: sensor_readings
```javascript
{
  type: "temperature|humidity|motion|light|door|pump|alarm",
  value: Mixed, // Valor de la lectura
  timestamp: Date,
  description: String,
  status: Boolean, // Para actuadores
  color: String, // Para LEDs RGB
  location: String // Ubicación del sensor/actuador
}
```

## Desarrollo

Para desarrollo, usar:
```bash
npm run dev
```

Esto iniciará el servidor con nodemon para recarga automática.

## Producción

Para producción:
```bash
npm start
```

## Integración con Frontend

El backend está diseñado para trabajar con el frontend React existente. Asegúrate de:

1. Configurar la URL del backend en el frontend
2. Conectar Socket.IO para actualizaciones en tiempo real
3. Manejar respuestas de la API

## Próximos Pasos

1. Implementar autenticación cuando sea necesario
2. Añadir validación de datos
3. Implementar logging
4. Añadir tests unitarios
5. Documentar API con Swagger
