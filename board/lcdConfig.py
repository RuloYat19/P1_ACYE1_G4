import os
import time
import json
import threading
import queue

try:
    from LCD import LCD as RawLCD
except Exception:
    RawLCD = None

try:
    from RPLCD.i2c import CharLCD
except Exception:
    CharLCD = None

import paho.mqtt.client as mqtt

class LCDService:
    def __init__(self):
        self.mqtt_host = os.environ.get("MQTT_HOST", "64430c7064d64067b68c5e59cd48a827.s1.eu.hivemq.cloud")
        self.mqtt_port = int(os.environ.get("MQTT_PORT", "8883"))
        self.mqtt_user = os.environ.get("MQTT_USERNAME", "keneth")
        self.mqtt_pass = os.environ.get("MQTT_PASSWORD", "ArquiGrupo4")
        self.mqtt_client_id = os.environ.get("MQTT_CLIENT_ID", "raspberry-lcd")
        self.topics = [
            ("/temperatura", 0),
            ("/humedad_aire", 0),
            ("/humedad_suelo", 0),
            ("/ilumination", 0),
            ("/pump", 0),
            ("/entrance", 0),
            ("/alerts", 0),
            ("/fan", 0),
        ]
        self.state = {"temp": None, "hum": None}
        self.event_q = queue.Queue(maxsize=10)
        self.lcd = None
        self.lcd_type = None
        self._make_lcd()
        self._stop = threading.Event()
        self._threads = []

    def _make_lcd(self):
        if RawLCD is not None:
            try:
                self.lcd = RawLCD(pi_rev=2, i2c_addr=0x27, backlight=True)
                self.lcd_type = "raw"
                return
            except Exception:
                self.lcd = None
                self.lcd_type = None
        if CharLCD is not None:
            try:
                self.lcd = CharLCD(i2c_expander="PCF8574", address=0x27, port=1, cols=16, rows=2, auto_linebreaks=False)
                self.lcd_type = "rplcd"
                return
            except Exception:
                self.lcd = None
                self.lcd_type = None

    def write(self, line1, line2):
        l1 = (line1 or "")[:16]
        l2 = (line2 or "")[:16]
        if self.lcd is None:
            print("LCD | " + l1.ljust(16) + " | " + l2.ljust(16))
            return
        if self.lcd_type == "raw":
            try:
                self.lcd.clear()
            except Exception:
                pass
            try:
                self.lcd.message(l1, 1)
                self.lcd.message(l2, 2)
                return
            except Exception:
                try:
                    self.lcd.message(l1 + "\n" + l2)
                except Exception:
                    pass
            return
        if self.lcd_type == "rplcd":
            try:
                self.lcd.clear()
                self.lcd.cursor_pos = (0, 0)
                self.lcd.write_string(l1.ljust(16))
                self.lcd.cursor_pos = (1, 0)
                self.lcd.write_string(l2.ljust(16))
            except Exception:
                pass

    def on_connect(self, client, userdata, flags, rc, properties=None):
        for t, q in self.topics:
            client.subscribe(t, qos=q)

    def handle_event(self, topic, payload):
        if topic == "/temperatura":
            t = payload.get("temperature")
            h = payload.get("humidity")
            if t is not None:
                self.state["temp"] = float(t)
            if h is not None:
                self.state["hum"] = float(h)
            return None
        if topic == "/humedad_aire":
            h = payload.get("humidity")
            if h is not None:
                self.state["hum"] = float(h)
            return None
        if topic == "/humedad_suelo":
            s = payload.get("state")
            if s in ("humedo", "seco"):
                return "Suelo " + s
            return None
        if topic == "/ilumination":
            room = payload.get("room") or payload.get("location") or "Room"
            on = payload.get("state") or payload.get("on")
            return "Luz " + room + " " + ("ON" if on else "OFF")
        if topic == "/pump":
            on = payload.get("state") or payload.get("on")
            return "Bomba " + ("ON" if on else "OFF")
        if topic == "/entrance":
            a = payload.get("action") or payload.get("state") or "OPEN"
            return "Entrada " + str(a).upper()
        if topic == "/alerts":
            m = payload.get("message") or payload.get("type") or "ALERTA"
            return str(m)[:16]
        return None

    def on_message(self, client, userdata, msg):
        try:
            payload = json.loads(msg.payload.decode())
        except Exception:
            payload = {}
        evt = self.handle_event(msg.topic, payload)
        if evt:
            try:
                self.event_q.put_nowait(evt)
            except queue.Full:
                pass

    def mqtt_loop(self):
        client = mqtt.Client(client_id=self.mqtt_client_id)
        client.username_pw_set(self.mqtt_user, self.mqtt_pass)
        client.tls_set()
        client.on_connect = self.on_connect
        client.on_message = self.on_message
        client.connect(self.mqtt_host, self.mqtt_port, keepalive=60)
        client.loop_start()
        while not self._stop.is_set():
            time.sleep(0.5)
        client.loop_stop()
        try:
            client.disconnect()
        except Exception:
            pass

    def display_loop(self):
        last = None
        until = 0.0
        while not self._stop.is_set():
            now = time.time()
            if last and now < until:
                line1 = "{}C {}%".format(self.state["temp"] if self.state["temp"] is not None else "--", self.state["hum"] if self.state["hum"] is not None else "--")
                self.write(line1, last)
            else:
                try:
                    last = self.event_q.get_nowait()
                    until = time.time() + 6.0
                except queue.Empty:
                    line1 = "{}C {}%".format(self.state["temp"] if self.state["temp"] is not None else "--", self.state["hum"] if self.state["hum"] is not None else "--")
                    self.write(line1, "Estado")
                    time.sleep(1.0)
                    continue
            time.sleep(0.5)

    def start(self):
        self._stop.clear()
        t1 = threading.Thread(target=self.mqtt_loop, daemon=True)
        t2 = threading.Thread(target=self.display_loop, daemon=True)
        t1.start()
        t2.start()
        self._threads = [t1, t2]

    def stop(self):
        self._stop.set()
        for t in self._threads:
            t.join(timeout=2)
        try:
            if self.lcd:
                self.lcd.clear()
        except Exception:
            pass

def main():
    svc = LCDService()
    try:
        svc.start()
        while True:
            time.sleep(2.0)
    except KeyboardInterrupt:
        pass
    finally:
        svc.stop()

if __name__ == "__main__":
    main()
