import time
import json
import threading
import queue
import os

import paho.mqtt.client as mqtt
from RPLCD.i2c import CharLCD 

# Config MQTT / LCD (ajusta según tu entorno)
MQTT_HOST = os.environ.get('MQTT_HOST', '64430c7064d64067b68c5e59cd48a827.s1.eu.hivemq.cloud')
MQTT_PORT = int(os.environ.get('MQTT_PORT', '8883'))
MQTT_USER = os.environ.get('MQTT_USERNAME', 'keneth')
MQTT_PASS = os.environ.get('MQTT_PASSWORD', 'ArquiGrupo4')
MQTT_CLIENT_ID = os.environ.get('MQTT_CLIENT_ID', 'raspberry-lcd')

I2C_ADDR = 0x27 
I2C_PORT = 1

TOPICS = [
  ('/temperatura', 0),
  ('/humedad_aire', 0),
  ('/ilumination', 0),
  ('/pump', 0),
  ('/entrance', 0),
  ('/alerts', 0),
  ('/humedad_suelo', 0),
  ('/fan', 0),
]

# Estado compartido
state = {
  'temp': None,
  'hum': None,
}
event_q = queue.Queue(maxsize=10)

# Inicializa LCD
lcd = CharLCD('PCF8574', I2C_ADDR, port=I2C_PORT, cols=16, rows=2, auto_linebreaks=False)

def safe_write(line1, line2):
  lcd.clear()
  lcd.cursor_pos = (0, 0)
  lcd.write_string(line1[:16].ljust(16))
  lcd.cursor_pos = (1, 0)
  lcd.write_string(line2[:16].ljust(16))

def on_connect(client, userdata, flags, rc, properties=None):
  print('LCD: conectado a MQTT', rc)
  for t, q in TOPICS:
    client.subscribe(t, qos=q)

def handle_event(topic, payload):
  if topic == '/temperatura':
    t = payload.get('temperature')
    h = payload.get('humidity')
    if t is not None:
      state['temp'] = float(t)
    if h is not None:
      state['hum'] = float(h)
    return None 
  if topic == '/humedad_aire':
    state['hum'] = float(payload.get('humidity', state.get('hum') or 0))
    return None
  if topic == '/ilumination':
    room = payload.get('room') or payload.get('location') or payload.get('target') or 'Room'
    status = payload.get('state') or payload.get('on') or payload.get('value')
    if payload.get('source') == 'PIR_exterior' or payload.get('external') is True:
      return None
    text = f"Luz: {room} {'ON' if status else 'OFF'}"
    return text
  if topic == '/pump':
    if payload.get('state') or payload.get('on'):
      hum_text = f"H:{payload.get('humidity') or payload.get('soil') or ''}"
      return f"Bomba ON {hum_text}"
    return "Bomba OFF"
  if topic == '/entrance':
    action = payload.get('action') or payload.get('state') or 'OPEN'
    return f"Entrada: {action}".upper()
  if topic == '/alerts':
    msg = payload.get('message') or payload.get('type') or 'ALERTA'
    return f"!!! {msg}"[:16]
  if topic == '/humedad_suelo':
    if payload.get('state') == 'humedo' or payload.get('state') == 'seco':
      return f"Suelo:{payload.get('state')}"
  return None

def on_message(client, userdata, msg):
  try:
    payload = json.loads(msg.payload.decode())
  except Exception:
    payload = {}
  evt = handle_event(msg.topic, payload)
  if evt:
    try:
      event_q.put_nowait(evt)
    except queue.Full:
      pass

def mqtt_thread():
  client = mqtt.Client(client_id=MQTT_CLIENT_ID)
  client.username_pw_set(MQTT_USER, MQTT_PASS)
  client.tls_set()  
  client.on_connect = on_connect
  client.on_message = on_message
  client.connect(MQTT_HOST, MQTT_PORT, keepalive=60)
  client.loop_forever()

def display_loop():
  last_event = None
  event_expire = 0
  while True:
    try:
      if last_event and time.time() < event_expire:
        line1 = f"{state['temp'] or '--'}C {state['hum'] or '--'}%"
        safe_write(line1, last_event)
      else:
        try:
          last_event = event_q.get_nowait()
          event_expire = time.time() + 6.0
        except queue.Empty:
          line1 = f"{(state['temp'] if state['temp'] is not None else '--')}C {(state['hum'] if state['hum'] is not None else '--')}%"
          safe_write(line1, "Estado")
          time.sleep(1.0)
          continue
    except Exception as e:
      print('LCD error', e)
    time.sleep(0.5)

if __name__ == '__main__':
  t = threading.Thread(target=mqtt_thread, daemon=True)
  t.start()
  try:
    display_loop()
  except KeyboardInterrupt:
    lcd.clear()