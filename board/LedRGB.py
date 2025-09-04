import os
import time
import json
import threading
import argparse

try:
    import RPi.GPIO as GPIO
except Exception:
    GPIO = None

import paho.mqtt.client as mqtt

class LedRGB:
    def __init__(self, red_pin=33, green_pin=32, blue_pin=12):
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
        self._setup_gpio()
        self._setup_mqtt()

    def _setup_gpio(self):
        if GPIO is None:
            print("GPIO not available")
            return
            
        GPIO.setmode(GPIO.BCM)
        GPIO.setup(self.red_pin, GPIO.OUT)
        GPIO.setup(self.green_pin, GPIO.OUT)
        GPIO.setup(self.blue_pin, GPIO.OUT)
        
        # Configurar PWM para control de intensidad
        self.red_pwm = GPIO.PWM(self.red_pin, 1000)    # 1kHz
        self.green_pwm = GPIO.PWM(self.green_pin, 1000)
        self.blue_pwm = GPIO.PWM(self.blue_pin, 1000)
        
        # Iniciar PWM con 0% duty cycle (LED apagado)
        self.red_pwm.start(0)
        self.green_pwm.start(0)
        self.blue_pwm.start(0)

    def _setup_mqtt(self):
        self.client = mqtt.Client(client_id=self.mqtt_client_id)
        self.client.username_pw_set(self.mqtt_user, self.mqtt_pass)
        self.client.tls_set()
        
        # Callback para mensajes recibidos
        self.client.on_message = self._on_message
        self.client.on_connect = self._on_connect
        
        try:
            self.client.connect(self.mqtt_host, self.mqtt_port, 60)
            self.client.loop_start()
        except Exception as e:
            print(f"Error conectando a MQTT: {e}")

    def _on_connect(self, client, userdata, flags, rc):
        print(f"Conectado a MQTT con código: {rc}")
        # Suscribirse al canal de control de iluminación
        client.subscribe("/illumination/control")
        client.subscribe("/illumination/room/+/control")

    def _on_message(self, client, userdata, msg):
        try:
            topic = msg.topic
            payload = json.loads(msg.payload.decode())
            print(f"Mensaje recibido en {topic}: {payload}")
            
            if "color" in payload:
                self.set_color_from_payload(payload)
            elif "rgb" in payload:
                self.set_rgb(payload["rgb"])
            elif "hex" in payload:
                self.set_hex_color(payload["hex"])
                
        except Exception as e:
            print(f"Error procesando mensaje: {e}")

    def set_rgb(self, rgb_values):
        """Establecer color RGB con valores 0-255"""
        if GPIO is None:
            print(f"Simulando RGB: R={rgb_values['r']}, G={rgb_values['g']}, B={rgb_values['b']}")
            return
            
        r = max(0, min(255, rgb_values.get('r', 0)))
        g = max(0, min(255, rgb_values.get('g', 0)))
        b = max(0, min(255, rgb_values.get('b', 0)))
        
        # Convertir 0-255 a 0-100 para PWM
        r_duty = (r / 255.0) * 100
        g_duty = (g / 255.0) * 100
        b_duty = (b / 255.0) * 100
        
        self.red_pwm.ChangeDutyCycle(r_duty)
        self.green_pwm.ChangeDutyCycle(g_duty)
        self.blue_pwm.ChangeDutyCycle(b_duty)
        
        self.current_color = {"red": r, "green": g, "blue": b}
        
        # Publicar estado actual
        self.publish_status()
        print(f"Color establecido: R={r}, G={g}, B={b}")

    def set_hex_color(self, hex_color):
        """Establecer color desde código hexadecimal"""
        hex_color = hex_color.lstrip('#')
        if len(hex_color) == 6:
            r = int(hex_color[0:2], 16)
            g = int(hex_color[2:4], 16)
            b = int(hex_color[4:6], 16)
            self.set_rgb({"r": r, "g": g, "b": b})

    def set_color_from_payload(self, payload):
        """Establecer color desde payload con diferentes formatos"""
        color = payload["color"].lower()
        
        # Colores predefinidos
        colors = {
            "rojo": {"r": 255, "g": 0, "b": 0},
            "red": {"r": 255, "g": 0, "b": 0},
            "verde": {"r": 0, "g": 255, "b": 0},
            "green": {"r": 0, "g": 255, "b": 0},
            "azul": {"r": 0, "g": 0, "b": 255},
            "blue": {"r": 0, "g": 0, "b": 255},
            "amarillo": {"r": 255, "g": 255, "b": 0},
            "yellow": {"r": 255, "g": 255, "b": 0},
            "morado": {"r": 128, "g": 0, "b": 128},
            "purple": {"r": 128, "g": 0, "b": 128},
            "cyan": {"r": 0, "g": 255, "b": 255},
            "magenta": {"r": 255, "g": 0, "b": 255},
            "blanco": {"r": 255, "g": 255, "b": 255},
            "white": {"r": 255, "g": 255, "b": 255},
            "off": {"r": 0, "g": 0, "b": 0},
            "apagado": {"r": 0, "g": 0, "b": 0}
        }
        
        if color in colors:
            self.set_rgb(colors[color])
        elif color.startswith('#'):
            self.set_hex_color(color)

    def publish_status(self):
        """Publicar estado actual del LED"""
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
            self.client.publish("/illumination", json.dumps(status_data))
            print(f"Estado publicado: {status_data}")
        except Exception as e:
            print(f"Error publicando estado: {e}")

    def test_colors(self):
        """Función para probar diferentes colores"""
        test_colors = [
            {"name": "Rojo", "rgb": {"r": 255, "g": 0, "b": 0}},
            {"name": "Verde", "rgb": {"r": 0, "g": 255, "b": 0}},
            {"name": "Azul", "rgb": {"r": 0, "g": 0, "b": 255}},
            {"name": "Amarillo", "rgb": {"r": 255, "g": 255, "b": 0}},
            {"name": "Morado", "rgb": {"r": 128, "g": 0, "b": 128}},
            {"name": "Cyan", "rgb": {"r": 0, "g": 255, "b": 255}},
            {"name": "Blanco", "rgb": {"r": 255, "g": 255, "b": 255}},
            {"name": "Apagado", "rgb": {"r": 0, "g": 0, "b": 0}}
        ]
        
        for color in test_colors:
            print(f"Probando color: {color['name']}")
            self.set_rgb(color['rgb'])
            time.sleep(2)

    def cleanup(self):
        """Limpiar recursos"""
        if GPIO:
            self.red_pwm.stop()
            self.green_pwm.stop()
            self.blue_pwm.stop()
            GPIO.cleanup()
        
        if self.client:
            self.client.loop_stop()
            self.client.disconnect()

def main():
    parser = argparse.ArgumentParser(description='Control de LED RGB via MQTT')
    parser.add_argument('--red-pin', type=int, default=18, help='Pin GPIO para LED rojo')
    parser.add_argument('--green-pin', type=int, default=19, help='Pin GPIO para LED verde')
    parser.add_argument('--blue-pin', type=int, default=20, help='Pin GPIO para LED azul')
    parser.add_argument('--test', action='store_true', help='Ejecutar prueba de colores')
    
    args = parser.parse_args()
    
    controller = RGBLEDController(args.red_pin, args.green_pin, args.blue_pin)
    
    try:
        if args.test:
            print("Ejecutando prueba de colores...")
            controller.test_colors()
        else:
            print("Controlador RGB iniciado. Esperando comandos MQTT...")
            print("Tópicos de escucha:")
            print("  - /illumination/control")
            print("  - /illumination/room/+/control")
            
            while True:
                time.sleep(1)
                
    except KeyboardInterrupt:
        print("Deteniendo controlador...")
    finally:
        controller.cleanup()

if __name__ == "__main__":
    main()