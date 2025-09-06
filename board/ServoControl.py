import os
import time
import json
import threading
import logging

try:
    import RPi.GPIO as GPIO
except Exception:
    GPIO = None

import paho.mqtt.client as mqtt

# Configurar logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class ServoService:
    def __init__(self, servo_pin=8, open_angle=90, close_angle=0):

        self.servo_pin = servo_pin
        self.open_angle = open_angle
        self.close_angle = close_angle
        self.auto_close_delay = 5.0  # 5 segundos
        

        self.mqtt_host = os.environ.get("MQTT_HOST", "e5f139d580314d5b83135987a80b78f1.s1.eu.hivemq.cloud")
        self.mqtt_port = int(os.environ.get("MQTT_PORT", "8883"))
        self.mqtt_user = os.environ.get("MQTT_USERNAME", "isaac")
        self.mqtt_pass = os.environ.get("MQTT_PASSWORD", "ArquiGrupo4")
        self.mqtt_client_id = os.environ.get("MQTT_CLIENT_ID", "raspberry-servo")
        
        # Estado del servo
        self.is_open = False
        self.current_angle = close_angle
        self.close_timer = None
        
        # Control de hilos
        self.client = None
        self._stop = threading.Event()
        self._thread = None
        self.pwm = None
        
        logger.info(f"?? Servo configurado - GPIO {servo_pin}")

    def _setup_gpio(self):
        """Configurar GPIO para servomotor"""
        if GPIO is None:
            logger.warning("?? GPIO no disponible - modo simulacion")
            return
            
        try:
            GPIO.setmode(GPIO.BCM)
            GPIO.setup(self.servo_pin, GPIO.OUT)
            
            # Configurar PWM para servo (50Hz)
            self.pwm = GPIO.PWM(self.servo_pin, 50)
            self.pwm.start(0)
            
            self._move_to_angle(self.close_angle)
            
            logger.info(f"? Servo configurado - GPIO {self.servo_pin}")
            
        except Exception as e:
            logger.error(f"? Error configurando GPIO: {e}")

    def _setup_mqtt(self):
        """Configurar cliente MQTT"""
        try:
            self.client = mqtt.Client(client_id=self.mqtt_client_id)
            self.client.username_pw_set(self.mqtt_user, self.mqtt_pass)
            self.client.tls_set()
            
            self.client.on_message = self._on_message
            self.client.on_connect = self._on_connect
            
            logger.info("?? Conectando a MQTT...")
            self.client.connect(self.mqtt_host, self.mqtt_port, 60)
            self.client.loop_start()
            
        except Exception as e:
            logger.error(f"? Error configurando MQTT: {e}")

    def _on_connect(self, client, userdata, flags, rc):

        if rc == 0:
            logger.info("? Servo conectado a MQTT")
        else:
            logger.error(f"? Error conectando a MQTT - codigo: {rc}")
            
        # SOLO suscribirse a /door
        client.subscribe("/door")
        logger.info(f"?? Suscrito a: /door")
    def _on_message(self, client, userdata, msg):
        """Procesar mensajes MQTT - SOLO /door"""
        try:
            topic = msg.topic
            payload_str = msg.payload.decode()
            logger.info(f"?? Comando recibido en {topic}: {payload_str}")
            
            # SOLO procesar si es /door
            if topic != "/door":
                return
                
            try:
                data = json.loads(payload_str)
            except json.JSONDecodeError:
                logger.warning("?? Payload no es JSON valido")
                return
            
            # SOLO procesar {"action": "open"}
            if data.get("action") == "open":
                self.open_door()
            else:
                logger.info("?? Comando ignorado - solo se acepta {'action': 'open'}")
                
        except Exception as e:
            logger.error(f"? Error procesando mensaje: {e}")

    def _angle_to_duty_cycle(self, angle):
        """Convertir angulo a duty cycle"""
        angle = max(0, min(180, angle))
        duty_cycle = 2.5 + (angle / 180.0) * 10.0
        return duty_cycle

    def _move_to_angle(self, angle):
        """Mover servo a un angulo especifico"""
        if not self.pwm:
            logger.info(f"?? Simulando: Servo a {angle}")
            self.current_angle = angle
            return
            
        try:
            duty_cycle = self._angle_to_duty_cycle(angle)
            self.pwm.ChangeDutyCycle(duty_cycle)
            time.sleep(0.5)
            self.pwm.ChangeDutyCycle(0)
            
            self.current_angle = angle
            logger.info(f"?? Servo movido a {angle}")
            
        except Exception as e:
            logger.error(f"? Error moviendo servo: {e}")

    def open_door(self):
        """Abrir puerta"""
        if self.is_open:
            logger.info("?? Puerta ya esta abierta")
            return
            
        logger.info("?? ABRIENDO puerta...")
        self._move_to_angle(self.open_angle)
        self.is_open = True
        
        # Cancelar timer anterior si existe
        if self.close_timer:
            self.close_timer.cancel()
        
        # Programar cierre automatico en 5 segundos
        self.close_timer = threading.Timer(self.auto_close_delay, self._auto_close)
        self.close_timer.start()
        
        logger.info(f"? Cierre automatico en {self.auto_close_delay}s")
    def _auto_close(self):
        """Cierre automatico"""
        logger.info("?? Cerrando puerta automaticamente...")
        self._move_to_angle(self.close_angle)
        self.is_open = False

    def loop(self):
        """Loop principal del servicio"""
        self._setup_gpio()
        self._setup_mqtt()
        
        logger.info("?? Servo listo - esperando comando {'action': 'open'} en /door")
        
        try:
            while not self._stop.is_set():
                time.sleep(1)
        finally:
            self.cleanup()

    def start(self):
        """Iniciar servicio"""
        self._stop.clear()
        self._thread = threading.Thread(target=self.loop, daemon=True)
        self._thread.start()
        logger.info("?? Servicio de servo iniciado")

    def stop(self):
        """Detener servicio"""
        logger.info("?? Deteniendo servicio de servo...")
        self._stop.set()
        
        if self.close_timer:
            self.close_timer.cancel()
        
        if self._thread:
            self._thread.join(timeout=2)
        
        logger.info("? Servicio de servo detenido")

    def cleanup(self):
        """Limpiar recursos"""
        if self.is_open:
            logger.info("?? Cerrando puerta antes de salir...")
            self._move_to_angle(self.close_angle)
        
        if self.pwm:
            try:
                self.pwm.stop()
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
    service = ServoService()
    
    try:
        service.start()
        logger.info("?? Servo listo para comando: {'action': 'open'} en topico /door")
        
        while True:
            time.sleep(1)
            
    except KeyboardInterrupt:
        logger.info("?? Saliendo...")
    finally:
        service.stop()

if __name__ == "__main__":
    main()