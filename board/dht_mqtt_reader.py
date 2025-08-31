import time, os, json
from datetime import datetime
from pymongo import MongoClient
from dotenv import load_dotenv
import paho.mqtt.client as mqtt

load_dotenv()

try:
    import board  # type: ignore
    import adafruit_dht  # type: ignore
except Exception as e:  # pragma: no cover
    print('[WARN] Librerías hardware no disponibles:', e)
    board = None
    adafruit_dht = None

MONGO_URI = os.getenv('MONGO_URI')
DB_NAME = os.getenv('MONGO_DB', 'sensor_data')
COLLECTION = os.getenv('COLLECTION_DHT', 'dht11_readings')
MQTT_BROKER = os.getenv('MQTT_BROKER','broker.hivemq.com')
MQTT_PORT = int(os.getenv('MQTT_PORT','1883'))
TOPIC = os.getenv('MQTT_TOPIC_DHT','/sensors/dht11')
READ_INTERVAL = int(os.getenv('READ_INTERVAL','5'))

client_db = MongoClient(MONGO_URI)
col = client_db[DB_NAME][COLLECTION]
mqttc = mqtt.Client()

def init_sensor():
    if not adafruit_dht or not board:
        return None
    return adafruit_dht.DHT11(board.D4)

dht = init_sensor()

def loop():
    while True:
        try:
            if dht is None:
                import random
                t = 20 + random.random()*10
                h = 40 + random.random()*20
            else:
                t = dht.temperature
                h = dht.humidity
            if t is not None and h is not None:
                doc = { 'temperature': float(t), 'humidity': float(h), 'timestamp': datetime.utcnow() }
                col.insert_one(doc)
                payload = { 'temperature': t, 'humidity': h, 'ts': doc['timestamp'].isoformat() + 'Z' }
                mqttc.publish(TOPIC, json.dumps(payload), qos=0, retain=False)
                print(f"[SEND] {t}C {h}%")
        except Exception as e:
            print('[ERR]', e)
        time.sleep(READ_INTERVAL)

if __name__ == '__main__':
    mqttc.connect(MQTT_BROKER, MQTT_PORT, 60)
    mqttc.loop_start()
    loop()
