import time
import board
import adafruit_dht
import paho.mqtt.client as mqtt
import json
import os
from datetime import datetime

# Configuración del sensor DHT11
dht_device = adafruit_dht.DHT11(board.D4)

# Configuración MQTT - HiveMQ Cloud
MQTT_HOST = "abc123.s1.eu.hivemq.cloud"  # Reemplaza con tu cluster URL
MQTT_PORT = 8883
MQTT_USERNAME = "tu-usuario-hivemq"  # Reemplaza con tu usuario
MQTT_PASSWORD = "tu-password-hivemq"  # Reemplaza con tu password
MQTT_CLIENT_ID = "raspberry-pi-sensor"

# Temas MQTT
TEMPERATURE_TOPIC = "/temperature"
HUMIDITY_TOPIC = "/humidity"

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print("Conectado exitosamente a HiveMQ Cloud")
    else:
        print(f"Error de conexión. Código: {rc}")

def on_disconnect(client, userdata, rc):
    print("Desconectado de HiveMQ Cloud")

def on_publish(client, userdata, mid):
    print(f"Mensaje publicado con ID: {mid}")

# Configurar cliente MQTT
client = mqtt.Client(client_id=MQTT_CLIENT_ID)
client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)
client.tls_set()  # Habilitar TLS para conexión segura
client.on_connect = on_connect
client.on_disconnect = on_disconnect
client.on_publish = on_publish

# Conectar al broker
try:
    client.connect(MQTT_HOST, MQTT_PORT, 60)
    client.loop_start()
except Exception as e:
    print(f"Error conectando a MQTT: {e}")
    exit(1)

print("Iniciando lectura de sensores...")

while True:
    try:
        temperature_c = dht_device.temperature
        humidity = dht_device.humidity

        if temperature_c is not None and humidity is not None:
            timestamp = datetime.now().isoformat()
            
            # Preparar datos de temperatura
            temp_data = {
                "temperature": temperature_c,
                "location": "interior",
                "timestamp": timestamp,
                "device": "DHT11"
            }
            
            # Preparar datos de humedad
            humidity_data = {
                "humidity": humidity,
                "location": "interior", 
                "timestamp": timestamp,
                "device": "DHT11"
            }
            
            # Publicar temperatura
            temp_result = client.publish(TEMPERATURE_TOPIC, json.dumps(temp_data))
            if temp_result.rc == mqtt.MQTT_ERR_SUCCESS:
                print(f"Temperatura enviada: {temperature_c:.1f}°C")
            else:
                print(f"Error enviando temperatura: {temp_result.rc}")
            
            # Publicar humedad
            humidity_result = client.publish(HUMIDITY_TOPIC, json.dumps(humidity_data))
            if humidity_result.rc == mqtt.MQTT_ERR_SUCCESS:
                print(f"Humedad enviada: {humidity:.1f}%")
            else:
                print(f"Error enviando humedad: {humidity_result.rc}")
                
            print(f"Temperatura: {temperature_c:.1f}°C, Humedad: {humidity:.1f}%")
            
        else:
            print("Error: No se pudo leer el sensor. Reintentando...")

    except RuntimeError as error:
        print(f"Error de lectura: {error.args[0]}")
    except Exception as e:
        print(f"Error inesperado: {e}")

    time.sleep(30)  # Enviar datos cada 30 segundos
