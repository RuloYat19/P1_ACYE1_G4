import os
import time
import json
import threading

try:
    import RPi.GPIO as GPIO
except Exception:
    GPIO = None

import paho.mqtt.client as mqtt

class RGBLEDService:
    def __init__(self, red_pin=13, green_pin=12, blue_pin=18):
        self.red_pin = red_pin
        self.green_pin = green_pin
        self.blue_pin = blue_pin
        
        self.mqtt_host = os.environ.get("MQTT_HOST", "e5f139d580314d5b83135987a80b78f1.s1.eu.hivemq.cloud")
        self.mqtt_port = int(os.environ.get("MQTT_PORT", "8883"))
        self.mqtt_user = os.environ.get("MQTT_USERNAME", "isaac")
        self.mqtt_pass = os.environ.get("MQTT_PASSWORD", "ArquiGrupo4")
        self.mqtt_client_id = os.environ.get("MQTT_CLIENT_ID", "raspberry-pi-rgb-led")
        
        self.client = None
        self.current_color = {"red": 0, "green": 0, "blue": 0}
        self._stop = threading.Event()
        self._thread = None
        self.rgb_pwm = None
        
    def _setup_gpio(self):
        if GPIO is None:
            print("GPIO not available - modo simulacion")
            return
            
        try:
            GPIO.setmode(GPIO.BCM)
            GPIO.setup(self.red_pin, GPIO.OUT)
            GPIO.setup(self.green_pin, GPIO.OUT)
            GPIO.setup(self.blue_pin, GPIO.OUT)
            
            self.rgb_pwm = {
                'red': GPIO.PWM(self.red_pin, 1000),
                'green': GPIO.PWM(self.green_pin, 1000),
                'blue': GPIO.PWM(self.blue_pin, 1000)
            }
            
            for pwm in self.rgb_pwm.values():
                pwm.start(0)
            
            print(f"RGB LED configurado: R={self.red_pin}, G={self.green_pin}, B={self.blue_pin}")
        except Exception as e:
            print(f"Error configurando GPIO: {e}")

    def _setup_mqtt(self):
        self.client = mqtt.Client(client_id=self.mqtt_client_id)
        self.client.username_pw_set(self.mqtt_user, self.mqtt_pass)
        self.client.tls_set()
        
        self.client.on_message = self._on_message
        self.client.on_connect = self._on_connect
        
        try:
            self.client.connect(self.mqtt_host, self.mqtt_port, 60)
            self.client.loop_start()
        except Exception as e:
            print(f"Error conectando a MQTT: {e}")

    def _on_connect(self, client, userdata, flags, rc):
        print(f"RGB LED conectado a MQTT con codigo: {rc}")
        client.subscribe("/ilumination/control")
        client.subscribe("/ilumination/room/+/control")

    def _on_message(self, client, userdata, msg):
        try:
            topic = msg.topic
            payload_str = msg.payload.decode()
            print(f"RGB comando recibido en {topic}: {payload_str}")
            
            try:
                data = json.loads(payload_str)
            except json.JSONDecodeError as e:
                print(f"Error parseando JSON: {e}")
                data = {"color": payload_str.strip()}
            
            if "color" in data:
                self.set_color_from_payload(data)
            elif "rgb" in data:
                self.set_rgb(data["rgb"])
            elif "hex" in data:
                self.set_hex_color(data["hex"])
                
        except Exception as e:
            print(f"Error procesando mensaje RGB: {e}")

    def set_rgb(self, rgb_values):
        """Establecer color RGB con valores 0-255"""
        if not self.rgb_pwm:
            print(f"Simulando RGB: R={rgb_values.get('r', 0)}, G={rgb_values.get('g', 0)}, B={rgb_values.get('b', 0)}")
            self.current_color = {"red": rgb_values.get('r', 0), "green": rgb_values.get('g', 0), "blue": rgb_values.get('b', 0)}
            self.publish_status()
            return
            
        try:
            r = max(0, min(255, rgb_values.get('r', 0)))
            g = max(0, min(255, rgb_values.get('g', 0)))
            b = max(0, min(255, rgb_values.get('b', 0)))
            
            r_duty = (r / 255.0) * 100
            g_duty = (g / 255.0) * 100
            b_duty = (b / 255.0) * 100
            
            self.rgb_pwm['red'].ChangeDutyCycle(r_duty)
            self.rgb_pwm['green'].ChangeDutyCycle(g_duty)
            self.rgb_pwm['blue'].ChangeDutyCycle(b_duty)
            
            self.current_color = {"red": r, "green": g, "blue": b}
            self.publish_status()
            print(f"Color RGB establecido: R={r}, G={g}, B={b}")
        except Exception as e:
            print(f"Error estableciendo RGB: {e}")

    def set_hex_color(self, hex_color):
        """Establecer color desde codigo hexadecimal"""
        hex_color = hex_color.lstrip('#')
        if len(hex_color) == 6:
            try:
                r = int(hex_color[0:2], 16)
                g = int(hex_color[2:4], 16)
                b = int(hex_color[4:6], 16)
                self.set_rgb({"r": r, "g": g, "b": b})
            except ValueError as e:
                print(f"Error convirtiendo hex {hex_color}: {e}")
    def set_color_from_payload(self, payload):
        """Establecer color desde payload con diferentes formatos"""
        color = payload["color"].lower().strip()
        
        colors = {
            "rojo": {"r": 255, "g": 0, "b": 0},
            "red": {"r": 255, "g": 0, "b": 0},
            "verde": {"r": 0, "g": 255, "b": 0},
            "green": {"r": 0, "g": 255, "b": 0},
            "azul": {"r": 0, "g": 0, "b": 255},
            "blue": {"r": 0, "g": 0, "b": 255},
            "off": {"r": 0, "g": 0, "b": 0},
            "apagado": {"r": 0, "g": 0, "b": 0}
        }
        
        if color in colors:
            self.set_rgb(colors[color])
        elif color.startswith('#'):
            self.set_hex_color(color)
        else:
            print(f"Color no reconocido: {color}")

    def publish_status(self):
        """Publicar estado actual del LED"""
        if not self.client:
            return
            
        status_data = {
            "type": "light",
            "device": "rgb_led",
            "status": "on" if any(self.current_color.values()) else "off",
            "color": f"#{self.current_color['red']:02x}{self.current_color['green']:02x}{self.current_color['blue']:02x}",
            "rgb": self.current_color,
            "pin_red": f"GPIO{self.red_pin}",
            "pin_green": f"GPIO{self.green_pin}",
            "pin_blue": f"GPIO{self.blue_pin}",
            "timestamp": time.time()
        }
        
        try:
            self.client.publish("/ilumination", json.dumps(status_data))
        except Exception as e:
            print(f"Error publicando estado RGB: {e}")

    def loop(self):
        """Loop principal del servicio RGB"""
        self._setup_gpio()
        self._setup_mqtt()
        
        try:
            while not self._stop.is_set():
                time.sleep(1)
        finally:
            self.cleanup()

    def start(self):
        """Iniciar servicio RGB"""
        self._stop.clear()
        t = threading.Thread(target=self.loop, daemon=True)
        t.start()
        self._thread = t
        print("RGB LED service iniciado")

    def stop(self):
        """Detener servicio RGB"""
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=2)
        print("RGB LED service detenido")
    def cleanup(self):
        """Limpiar recursos"""
        if self.rgb_pwm:
            try:
                for pwm in self.rgb_pwm.values():
                    pwm.ChangeDutyCycle(0)
                    pwm.stop()
            except:
                pass
        
        if GPIO:
            try:
                GPIO.cleanup()
            except:
                pass
        
        if self.client:
            try:
                self.client.loop_stop()
                self.client.disconnect()
            except:
                pass
def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='Control de LED RGB via MQTT')
    parser.add_argument('--red-pin', type=int, default=13, help='Pin GPIO para LED rojo')
    parser.add_argument('--green-pin', type=int, default=12, help='Pin GPIO para LED verde')
    parser.add_argument('--blue-pin', type=int, default=18, help='Pin GPIO para LED azul')
    
    args = parser.parse_args()
    
    service = RGBLEDService(args.red_pin, args.green_pin, args.blue_pin)
    
    try:
        service.start()
        print("RGB LED service iniciado. Presiona Ctrl+C para detener...")
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("Deteniendo RGB LED service...")
    finally:
        service.stop()

if __name__ == "__main__":
    main()