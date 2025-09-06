import os
import time
import json
import threading

try:
    import RPi.GPIO as GPIO
except Exception:
    GPIO = None

import paho.mqtt.client as mqtt

class RoomLEDService:
    def __init__(self, room_configs=None):
        self.room_configs = room_configs or {
            "sala": {"pin": 16, "state": False},
            "cocina": {"pin": 20, "state": False},
            "dormitorio": {"pin": 21, "state": False}
        }
        
        self.mqtt_host = os.environ.get("MQTT_HOST", "e5f139d580314d5b83135987a80b78f1.s1.eu.hivemq.cloud")
        self.mqtt_port = int(os.environ.get("MQTT_PORT", "8883"))
        self.mqtt_user = os.environ.get("MQTT_USERNAME", "isaac")
        self.mqtt_pass = os.environ.get("MQTT_PASSWORD", "ArquiGrupo4")
        self.mqtt_client_id = os.environ.get("MQTT_CLIENT_ID", "raspberry-pi-room-leds")
        
        self.client = None
        self._stop = threading.Event()
        self._thread = None
        
    def _setup_gpio(self):
        if GPIO is None:
            print("GPIO not available - modo simulacion LEDs por habitacion")
            return
            
        try:
            GPIO.setmode(GPIO.BCM)
            for room, config in self.room_configs.items():
                pin = config["pin"]
                GPIO.setup(pin, GPIO.OUT)
                GPIO.output(pin, GPIO.LOW)  # Iniciar apagados
                print(f"LED {room} configurado en GPIO {pin}")
            
        except Exception as e:
            print(f"Error configurando GPIO para LEDs: {e}")

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
            print(f"Error conectando LEDs a MQTT: {e}")

    def _on_connect(self, client, userdata, flags, rc):
        print(f"LEDs por habitacion conectados a MQTT con codigo: {rc}")
        client.subscribe("/ilumination")
        client.subscribe("/light")
        client.subscribe("/actuators/light")
        client.subscribe("/room/+/light")  # Para comandos especificos por habitacion
    def _on_message(self, client, userdata, msg):
        try:
            topic = msg.topic
            payload_str = msg.payload.decode()
            print(f"LED comando recibido en {topic}: {payload_str}")
            
            try:
                data = json.loads(payload_str)
            except json.JSONDecodeError:
                # Si no es JSON, tratar como comando simple
                data = {"state": payload_str.strip()}
            
            # Procesar comando
            room = None
            state = None
            
            # Obtener habitacion del mensaje
            if "room" in data:
                room = data["room"].lower()
            elif "/room/" in topic:
                # Extraer habitacion del tipico: /room/sala/light
                parts = topic.split("/")
                if len(parts) >= 3:
                    room = parts[2].lower()
            
            # Obtener estado del mensaje
            if "state" in data:
                state = data["state"].lower().strip()
            
            # Si no se especifica habitacion, aplicar a todas
            if room is None:
                if state in ["on", "encendido", "1", "true"]:
                    self.turn_all_on()
                elif state in ["off", "apagado", "0", "false"]:
                    self.turn_all_off()
            else:
                # Control especifico por habitacion
                if state in ["on", "encendido", "1", "true"]:
                    self.turn_on_room(room)
                elif state in ["off", "apagado", "0", "false"]:
                    self.turn_off_room(room)
                
        except Exception as e:
            print(f"Error procesando mensaje LED: {e}")

    def turn_on_room(self, room):
        """Encender LED de una habitacion especifica"""
        room = room.lower()
        if room not in self.room_configs:
            print(f"Habitacion '{room}' no encontrada. Disponibles: {list(self.room_configs.keys())}")
            return
            
        config = self.room_configs[room]
        pin = config["pin"]
        
        if GPIO is None:
            print(f"Simulando: LED {room} ENCENDIDO")
            config["state"] = True
            self.publish_status(room)
            return
            
        try:
            GPIO.output(pin, GPIO.HIGH)
            config["state"] = True
            self.publish_status(room)
            print(f"? LED {room} ENCENDIDO (GPIO {pin})")
        except Exception as e:
            print(f"Error encendiendo LED {room}: {e}")
    def turn_off_room(self, room):
        """Apagar LED de una habitacion especifica"""
        room = room.lower()
        if room not in self.room_configs:
            print(f"Habitacion '{room}' no encontrada. Disponibles: {list(self.room_configs.keys())}")
            return
            
        config = self.room_configs[room]
        pin = config["pin"]
        
        if GPIO is None:
            print(f"Simulando: LED {room} APAGADO")
            config["state"] = False
            self.publish_status(room)
            return
            
        try:
            GPIO.output(pin, GPIO.LOW)
            config["state"] = False
            self.publish_status(room)
            print(f"? LED {room} APAGADO (GPIO {pin})")
        except Exception as e:
            print(f"Error apagando LED {room}: {e}")

    def turn_all_on(self):
        """Encender todos los LEDs"""
        for room in self.room_configs:
            self.turn_on_room(room)

    def turn_all_off(self):
        """Apagar todos los LEDs"""
        for room in self.room_configs:
            self.turn_off_room(room)

    def publish_status(self, room):
        """Publicar estado actual de un LED"""
        if not self.client:
            return
            
        config = self.room_configs[room]
        status_data = {
            "type": "light",
            "device": "room_led",
            "room": room,
            "status": "on" if config["state"] else "off",
            "pin": config["pin"],
            "timestamp": time.time()
        }
        
        try:
            # Publicar en tipico general y especifico
            self.client.publish("/ilumination/status", json.dumps(status_data))
            self.client.publish(f"/room/{room}/status", json.dumps(status_data))
        except Exception as e:
            print(f"Error publicando estado LED {room}: {e}")

    def get_status(self):
        """Obtener estado de todos los LEDs"""
        return {room: config["state"] for room, config in self.room_configs.items()}

    def loop(self):
        """Loop principal del servicio LEDs"""
        self._setup_gpio()
        self._setup_mqtt()
        
        try:
            while not self._stop.is_set():
                time.sleep(1)
        finally:
            self.cleanup()
    def start(self):
        """Iniciar servicio LEDs por habitacion"""
        self._stop.clear()
        t = threading.Thread(target=self.loop, daemon=True)
        t.start()
        self._thread = t
        print("LEDs por habitacion service iniciado")

    def stop(self):
        """Detener servicio LEDs"""
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=2)
        print("LEDs por habitacion service detenido")

    def cleanup(self):
        """Limpiar recursos"""
        # Apagar todos los LEDs antes de limpiar
        if GPIO:
            try:
                for config in self.room_configs.values():
                    GPIO.output(config["pin"], GPIO.LOW)
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
    
    parser = argparse.ArgumentParser(description='Control de LEDs por habitacion via MQTT')
    parser.add_argument('--sala-pin', type=int, default=16, help='Pin GPIO para LED sala')
    parser.add_argument('--cocina-pin', type=int, default=20, help='Pin GPIO para LED cocina')
    parser.add_argument('--dormitorio-pin', type=int, default=21, help='Pin GPIO para LED dormitorio')
    
    args = parser.parse_args()
    
    # Configuracion personalizada
    room_configs = {
        "sala": {"pin": args.sala_pin, "state": False},
        "cocina": {"pin": args.cocina_pin, "state": False},
        "dormitorio": {"pin": args.dormitorio_pin, "state": False}
    }
    
    service = RoomLEDService(room_configs)
    
    try:
        service.start()
        print("LEDs por habitacion iniciado. Presiona Ctrl+C para detener...")
        print("Configuracion:")
        for room, config in room_configs.items():
            print(f"  ?? {room.capitalize()}: GPIO {config['pin']}")
        print("\nComandos MQTT:")
        print("  - Habitacion especifica: {\"room\": \"sala\", \"state\": \"on\"}")
        print("  - Todas las luces: {\"state\": \"on\"}")
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("Deteniendo LEDs service...")
    finally:
        service.stop()

if __name__ == "__main__":
    main()