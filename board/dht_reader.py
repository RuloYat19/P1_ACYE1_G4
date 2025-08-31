import time
import os
from datetime import datetime
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

try:
    import board  # type: ignore
    import adafruit_dht  # type: ignore
except Exception as e:  # pragma: no cover
    print("[WARN] Librerías de hardware no disponibles en este entorno:", e)
    board = None
    adafruit_dht = None

READ_INTERVAL = int(os.getenv('READ_INTERVAL', '5'))
MONGO_URI = os.getenv('MONGO_URI')
DB_NAME = os.getenv('MONGO_DB', 'sensor_data')
COLLECTION = os.getenv('COLLECTION_DHT', 'dht11_readings')

client = MongoClient(MONGO_URI)
col = client[DB_NAME][COLLECTION]

def init_sensor():
    if not adafruit_dht or not board:
        return None
    return adafruit_dht.DHT11(board.D4)

dht_device = init_sensor()

def save_reading(temp_c, humidity):
    doc = {
        'temperature': float(temp_c),
        'humidity': float(humidity),
        'timestamp': datetime.utcnow()
    }
    col.insert_one(doc)
    print(f"[OK] Temp={temp_c:.1f}C Hum={humidity:.1f}%")

def main():
    while True:
        try:
            if dht_device is None:
                print('[SIM] Generando valores ficticios')
                import random
                t = 20 + random.random()*10
                h = 40 + random.random()*20
            else:
                t = dht_device.temperature
                h = dht_device.humidity
            if t is not None and h is not None:
                save_reading(t, h)
            else:
                print('[WARN] Lectura None, reintentando')
        except RuntimeError as e:  # DHT errores típicos
            print('[Runtime]', e.args[0])
        except Exception as e:
            print('[ERROR]', e)
        time.sleep(READ_INTERVAL)

if __name__ == '__main__':
    main()
