
import time
import board
import digitalio
import paho.mqtt.client as mqtt
import json
import time
import RPi.GPIO as GPIO
import json
from datetime import datetime

MQTT_HOST = "64430c7064d64067b68c5e59cd48a827.s1.eu.hivemq.cloud"
MQTT_PORT = 8883
MQTT_USERNAME = "keneth"
MQTT_PASSWORD = "ArquiGrupo4"
MQTT_CLIENT_ID = "raspberry-pi-soil-sensor"

SOIL_TOPIC = "/humedad_suelo"

CHANNEL = 26

def on_connect(client, userdata, flags, rc, properties=None):
	if rc == 0:
		print("Conectado exitosamente a HiveMQ Cloud")
	else:
		print(f"Error de conexion. Codigo: {rc}")

def on_disconnect(client, userdata, rc, properties=None):
	print("Desconectado de HiveMQ Cloud")

def on_publish(client, userdata, mid):
	print(f"Mensaje publicado con ID: {mid}")

def medirHumedad(samples=7, delay=0.02):
	readings = []
	for _ in range(samples):
		try:
			v = GPIO.input(CHANNEL)
		except Exception as e:
			print(f"Error leyendo GPIO{CHANNEL}: {e}")
			return None, False, []
		readings.append(int(bool(v)))
		time.sleep(delay)

	if len(readings) > 0 and all(r == readings[0] for r in readings):
		return readings[0], True, readings
	return None, False, readings

def main():
	GPIO.setmode(GPIO.BCM)
	GPIO.setup(CHANNEL, GPIO.IN)

	client = mqtt.Client(client_id=MQTT_CLIENT_ID)
	client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)
	client.tls_set()
	client.on_connect = on_connect
	client.on_disconnect = on_disconnect
	client.on_publish = on_publish

	try:
		client.connect(MQTT_HOST, MQTT_PORT, 60)
		client.loop_start()
	except Exception as e:
		print(f"Error conectando a MQTT: {e}")
		GPIO.cleanup()
		return

	print(f"Iniciando lectura de humedad de suelo en GPIO {CHANNEL}...")

	try:
		while True:
			value, connected, readings = medirHumedad()
			device_ts = datetime.now().isoformat()

			if connected:
				state = "seco" if value == 1 else "humedo"
				payload = {
					"soil_moisture_digital": int(value),
					"state": state,
					"pin": f"GPIO{CHANNEL}",
					"timestamp": device_ts,
					"device": "YL-69",
					"connected": True,
					"samples": len(readings),
					"stable": True,
					"raw_readings": readings
				}
				res = client.publish(SOIL_TOPIC, json.dumps(payload))
				if res.rc == mqtt.MQTT_ERR_SUCCESS:
					print(f"Humedad suelo enviada: {value} ({state}) - samples={len(readings)}")
				else:
					print(f"Error enviando humedad suelo: {res.rc}")
			else:
				print(f"Lectura inestable o sensor desconectado (samples={len(readings)}). No se publica.")

			time.sleep(5)
	except KeyboardInterrupt:
		print("Interrumpido por usuario")
	finally:
		GPIO.cleanup()
		client.loop_stop()
		client.disconnect()

if __name__ == "__main__":
	main()
