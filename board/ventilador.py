import os
import time
import json
import threading

try:
    import RPi.GPIO as GPIO
except Exception:
    GPIO = None

import paho.mqtt.client as mqtt

class FanService:
    def __init__(self, fan_pin=22):
        self.fan_pin = fan_pin
        self.mqtt_host = os.environ.get("MQTT_HOST", "9a9751de0a5f4cf48ef00e50f9450e27.s1.eu.hivemq.cloud")
        self.mqtt_port = int(os.environ.get("MQTT_PORT", "8883"))
        self.mqtt_user = os.environ.get("MQTT_USERNAME", "isaac")
        self.mqtt_pass = os.environ.get("MQTT_PASSWORD", "ArquiGrupo4")
        self.mqtt_client_id = os.environ.get("MQTT_CLIENT_ID", "raspberry-pi-fan")
        self.temp_topic = os.environ.get("TEMP_TOPIC", "/temperatura")
        try:
            self.temp_threshold = float(os.environ.get("TEMP_THRESHOLD", "20.0"))
        except Exception:
            self.temp_threshold = 20.0
        self.auto_off = str(os.environ.get("TEMP_AUTO_OFF", "1")).lower() in ("1", "true", "yes")
        self.fan_state = False
        self.client = None
        self._stop = threading.Event()
        self._thread = None

    def _setup_gpio(self):
        if GPIO is None:
            return
        try:
            GPIO.setmode(GPIO.BCM)
            GPIO.setup(self.fan_pin, GPIO.OUT)
            GPIO.output(self.fan_pin, GPIO.LOW)
        except Exception:
            pass

    def _setup_mqtt(self):
        try:
            self.client = mqtt.Client(client_id=self.mqtt_client_id)
            try:
                self.client.username_pw_set(self.mqtt_user, self.mqtt_pass)
            except Exception:
                pass
            try:
                self.client.tls_set()
            except Exception:
                pass
            self.client.on_message = self._on_message
            self.client.on_connect = self._on_connect
            self.client.connect(self.mqtt_host, self.mqtt_port, 60)
            self.client.loop_start()
        except Exception:
            pass

    def _on_connect(self, client, userdata, flags, rc):
        topics = ["/fan", "/ventilador", "/actuators/fan", self.temp_topic]
        for topic in topics:
            try:
                client.subscribe(topic)
            except Exception:
                pass

    def _on_message(self, client, userdata, msg):
        try:
            payload_str = msg.payload.decode()
        except Exception:
            return
        if msg.topic == self.temp_topic:
            try:
                data = json.loads(payload_str)
            except Exception:
                try:
                    data = float(payload_str.strip())
                except Exception:
                    return
            self._handle_temperature(data)
            return
        try:
            data = json.loads(payload_str)
        except Exception:
            data = {"state": payload_str.strip()}
        self._handle_fan_command(data)

    def _handle_temperature(self, data):
        try:
            t = None
            if isinstance(data, dict):
                if "temperature" in data:
                    t = float(data.get("temperature"))
                elif "temp" in data:
                    t = float(data.get("temp"))
            else:
                t = float(data)
        except Exception:
            return
        if t is None:
            return
        if t >= self.temp_threshold:
            self.turn_on()
        else:
            if self.auto_off:
                self.turn_off()

    def _handle_fan_command(self, data):
        try:
            if "state" in data:
                state = str(data["state"]).lower().strip()
                if state in ["on", "encendido", "1", "true"]:
                    self.turn_on()
                elif state in ["off", "apagado", "0", "false"]:
                    self.turn_off()
            elif "command" in data:
                cmd = str(data["command"]).lower().strip()
                if cmd in ["on", "encender"]:
                    self.turn_on()
                elif cmd in ["off", "apagar"]:
                    self.turn_off()
        except Exception:
            pass

    def turn_on(self):
        if GPIO is not None:
            try:
                GPIO.output(self.fan_pin, GPIO.HIGH)
            except Exception:
                pass
        self.fan_state = True
        self.publish_status()

    def turn_off(self):
        if GPIO is not None:
            try:
                GPIO.output(self.fan_pin, GPIO.LOW)
            except Exception:
                pass
        self.fan_state = False
        self.publish_status()

    def publish_status(self):
        if not self.client:
            return
        status_data = {
            "type": "fan",
            "device": "cooling_fan",
            "state": "on" if self.fan_state else "off",
            "status": self.fan_state,
            "pin": self.fan_pin,
            "timestamp": time.time()
        }
        try:
            self.client.publish("/fan/status", json.dumps(status_data))
        except Exception:
            pass

    def loop(self):
        self._setup_gpio()
        self._setup_mqtt()
        try:
            while not self._stop.is_set():
                time.sleep(1)
        finally:
            self.cleanup()

    def start(self):
        self._stop.clear()
        self._thread = threading.Thread(target=self.loop, daemon=True)
        self._thread.start()

    def stop(self):
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=2)

    def cleanup(self):
        if GPIO and self.fan_state:
            try:
                GPIO.output(self.fan_pin, GPIO.LOW)
            except Exception:
                pass
        if GPIO:
            try:
                GPIO.cleanup()
            except Exception:
                pass
        if self.client:
            try:
                self.client.loop_stop()
                self.client.disconnect()
            except Exception:
                pass

def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--pin", type=int, default=22)
    parser.add_argument("--test", action="store_true")
    args = parser.parse_args()
    service = FanService(args.pin)
    if args.test:
        service._setup_gpio()
        try:
            service.turn_on()
            time.sleep(5)
            service.turn_off()
        finally:
            service.cleanup()
        return
    try:
        service.start()
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        pass
    finally:
        service.stop()

if __name__ == "__main__":
    main()