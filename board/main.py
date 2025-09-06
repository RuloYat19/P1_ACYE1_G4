import argparse
import time

from lcdConfig import LCDService
from lecturaTemperatura import DHTPublisher
from lecturaHumedadSuelo import SoilPublisher
import LedRGB
import LedsPorHabitacion
import SensorMovimiento
import ServoControl
import ventilador


def pick_class(module, candidates):
    for name in candidates:
        cls = getattr(module, name, None)
        if cls:
            return cls
    return None


RGBClass = pick_class(LedRGB, ["RGBLEDService", "LedRGBService", "RGBService"])
RoomsClass = pick_class(LedsPorHabitacion, ["RoomLEDService", "LedsPorHabitacionService", "LedsPorHabitacion"])
MotionClass = pick_class(SensorMovimiento, ["MotionPublisher", "MotionSensor", "SensorMovimiento"])
ServoClass = pick_class(ServoControl, ["ServoService"])
FanClass = pick_class(ventilador, ["FanService"])


def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--lcd", action="store_true")
    p.add_argument("--temp", action="store_true")
    p.add_argument("--soil", action="store_true")
    p.add_argument("--rgb", action="store_true")
    p.add_argument("--rooms", action="store_true")
    p.add_argument("--motion", action="store_true")
    p.add_argument("--servo", action="store_true")
    p.add_argument("--fan", action="store_true")
    return p.parse_args()


def main():
    args = parse_args()
    run_all = not (args.lcd or args.temp or args.soil or args.rgb or args.rooms or args.motion or args.servo or args.fan)

    services = []
    if run_all or args.lcd:
        services.append(LCDService())
    if run_all or args.temp:
        services.append(DHTPublisher())
    if run_all or args.soil:
        services.append(SoilPublisher())
    if (run_all or args.rgb) and RGBClass:
        services.append(RGBClass())
    if (run_all or args.rooms) and RoomsClass:
        services.append(RoomsClass())
    if (run_all or args.motion) and MotionClass:
        services.append(MotionClass())
    if (run_all or args.servo) and ServoClass:
        services.append(ServoClass())
    if (run_all or args.fan) and FanClass:
        services.append(FanClass())

    try:
        for s in services:
            s.start()
        while True:
            time.sleep(2.0)
    except KeyboardInterrupt:
        pass
    finally:
        for s in services:
            try:
                s.stop()
            except Exception:
                pass


if __name__ == "__main__":
    main()