import os
import time
import threading
import logging
import requests
from datetime import datetime

try:
    import RPi.GPIO as GPIO
except Exception:
    GPIO = None

# Configurar logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class MotionSensorService:
    def __init__(self, trig_pin=23, echo_pin=24, led_pin=25, distance_threshold=30):
        """
        Sensor ultrasónico con LED de movimiento - Sin MQTT
        """
        self.trig_pin = trig_pin
        self.echo_pin = echo_pin
        self.led_pin = led_pin
        self.distance_threshold = distance_threshold
        
        # Configuración del backend
        self.backend_url = os.environ.get("BACKEND_URL", "http://localhost:3001")
        
        # Estado del sistema
        self.led_state = False
        self.motion_detected = False
        self.last_motion_time = 0
        self.motion_timeout = 5.0  # 5 segundos
        
        # Control de hilos
        self._stop = threading.Event()
        self._thread = None
        
        logger.info(f"🎯 Sensor movimiento - TRIG:{trig_pin}, ECHO:{echo_pin}, LED:{led_pin}")

    def _setup_gpio(self):
        """Configurar GPIO para sensor y LED"""
        if GPIO is None:
            logger.warning("⚠️ GPIO no disponible - modo simulación")
            return
            
        try:
            GPIO.setmode(GPIO.BCM)
            
            # Configurar sensor ultrasónico
            GPIO.setup(self.trig_pin, GPIO.OUT)
            GPIO.setup(self.echo_pin, GPIO.IN)
            GPIO.output(self.trig_pin, GPIO.LOW)
            
            # Configurar LED
            GPIO.setup(self.led_pin, GPIO.OUT)
            GPIO.output(self.led_pin, GPIO.LOW)
            
            logger.info(f"✅ GPIO configurado - Sensor: {self.trig_pin}/{self.echo_pin}, LED: {self.led_pin}")
            
        except Exception as e:
            logger.error(f"❌ Error configurando GPIO: {e}")

    def measure_distance(self):
        """Medir distancia con sensor ultrasónico"""
        if GPIO is None:
            # Simulación: generar distancia aleatoria
            import random
            return random.uniform(10, 50)
            
        try:
            # Enviar pulso de 10us
            GPIO.output(self.trig_pin, GPIO.HIGH)
            time.sleep(0.00001)  # 10 microsegundos
            GPIO.output(self.trig_pin, GPIO.LOW)
            
            # Medir tiempo de eco
            start_time = time.time()
            timeout = start_time + 0.1  # Timeout 100ms
            
            # Esperar a que ECHO esté HIGH
            while GPIO.input(self.echo_pin) == GPIO.LOW:
                start_time = time.time()
                if start_time > timeout:
                    return None
            
            # Esperar a que ECHO esté LOW
            end_time = time.time()
            while GPIO.input(self.echo_pin) == GPIO.HIGH:
                end_time = time.time()
                if end_time > timeout:
                    return None
            
            # Calcular distancia (velocidad sonido = 34300 cm/s)
            duration = end_time - start_time
            distance = (duration * 34300) / 2
            
            return distance if distance < 400 else None  # Max range ~4m
            
        except Exception as e:
            logger.error(f"❌ Error midiendo distancia: {e}")
            return None

    def turn_led_on(self):
        """Encender LED"""
        if GPIO is None:
            logger.info("💡 Simulando: LED ENCENDIDO")
        else:
            try:
                GPIO.output(self.led_pin, GPIO.HIGH)
                logger.info(f"💡 LED ENCENDIDO (GPIO {self.led_pin})")
            except Exception as e:
                logger.error(f"❌ Error encendiendo LED: {e}")
                return
        
        self.led_state = True

    def turn_led_off(self):
        """Apagar LED"""
        if GPIO is None:
            logger.info("💡 Simulando: LED APAGADO")
        else:
            try:
                GPIO.output(self.led_pin, GPIO.LOW)
                logger.info(f"💡 LED APAGADO (GPIO {self.led_pin})")
            except Exception as e:
                logger.error(f"❌ Error apagando LED: {e}")
                return
        
        self.led_state = False

    def register_motion_detection(self):
        """Registrar detección de movimiento en la base de datos"""
        try:
            motion_data = {
                "type": "motion_sensor",
                "value": "motion_detected",
                "description": "Movimiento detectado por sensor ultrasónico",
                "status": True,
                "location": "entrada",
                "device": "ultrasonic_sensor",
                "threshold": self.distance_threshold,
                "pins": {
                    "trig": self.trig_pin,
                    "echo": self.echo_pin,
                    "led": self.led_pin
                }
            }
            
            response = requests.post(
                f"{self.backend_url}/api/sensors/motion",
                json=motion_data,
                timeout=5
            )
            
            if response.status_code == 200:
                logger.info("📝 Movimiento registrado en base de datos")
            else:
                logger.warning(f"⚠️ Error registrando movimiento: {response.status_code}")
                
        except Exception as e:
            logger.error(f"❌ Error enviando datos al backend: {e}")

    def loop(self):
        """Loop principal del sensor"""
        self._setup_gpio()
        
        logger.info(f"🎯 Iniciando detección de movimiento (umbral: {self.distance_threshold}cm)")
        logger.info(f"🌐 Backend URL: {self.backend_url}")
        
        try:
            while not self._stop.is_set():
                # Medir distancia
                distance = self.measure_distance()
                
                if distance is not None:
                    current_time = time.time()
                    
                    # Detectar movimiento (objeto cerca) - TRANSICIÓN DE BAJO A ALTO
                    if distance <= self.distance_threshold:
                        if not self.motion_detected:
                            logger.info(f"🎯 MOVIMIENTO DETECTADO - Distancia: {distance:.1f}cm")
                            self.motion_detected = True
                            self.turn_led_on()
                            
                            # REGISTRAR EN BASE DE DATOS SOLO EN LA TRANSICIÓN
                            self.register_motion_detection()
                        
                        self.last_motion_time = current_time
                    
                    # Verificar timeout (sin movimiento por 5 segundos)
                    elif self.motion_detected and (current_time - self.last_motion_time) >= self.motion_timeout:
                        logger.info(f"⏰ Sin movimiento por {self.motion_timeout}s - Apagando LED")
                        self.motion_detected = False
                        self.turn_led_off()
                
                time.sleep(0.1)  # Leer cada 100ms
                
        finally:
            self.cleanup()

    def start(self):
        """Iniciar servicio"""
        self._stop.clear()
        self._thread = threading.Thread(target=self.loop, daemon=True)
        self._thread.start()
        logger.info("🚀 Servicio de sensor movimiento iniciado")

    def stop(self):
        """Detener servicio"""
        logger.info("🛑 Deteniendo sensor movimiento...")
        self._stop.set()
        
        if self._thread:
            self._thread.join(timeout=2)
        
        logger.info("✅ Sensor movimiento detenido")

    def cleanup(self):
        """Limpiar recursos"""
        # Apagar LED
        if GPIO and self.led_state:
            try:
                GPIO.output(self.led_pin, GPIO.LOW)
                logger.info("💡 LED apagado")
            except:
                pass
        
        # Limpiar GPIO
        if GPIO:
            try:
                GPIO.cleanup()
            except:
                pass

def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='Sensor ultrasónico con LED')
    parser.add_argument('--trig', type=int, default=23, help='Pin GPIO TRIG')
    parser.add_argument('--echo', type=int, default=24, help='Pin GPIO ECHO')
    parser.add_argument('--led', type=int, default=25, help='Pin GPIO LED')
    parser.add_argument('--threshold', type=float, default=30, help='Distancia umbral en cm')
    
    args = parser.parse_args()
    
    service = MotionSensorService(args.trig, args.echo, args.led, args.threshold)
    
    try:
        service.start()
        logger.info("🎯 Sensor de movimiento activo...")
        logger.info(f"📏 Umbral de detección: {args.threshold}cm")
        logger.info("⏰ Timeout sin movimiento: 5 segundos")
        logger.info("📝 Registros se guardan en transición bajo->alto")
        
        while True:
            time.sleep(1)
            
    except KeyboardInterrupt:
        logger.info("👋 Saliendo...")
    finally:
        service.stop()

if __name__ == "__main__":
    main()