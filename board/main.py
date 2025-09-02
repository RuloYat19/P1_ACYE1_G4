import argparse
import time
from lcdConfig import LCDService
from lecturaTemperatura import DHTPublisher
from lecturaHumedadSuelo import SoilPublisher

def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--lcd", action="store_true")
    p.add_argument("--temp", action="store_true")
    p.add_argument("--soil", action="store_true")
    return p.parse_args()

def main():
    args = parse_args()
    run_all = not (args.lcd or args.temp or args.soil)
    services = []
    if run_all or args.lcd:
        services.append(LCDService())
    if run_all or args.temp:
        services.append(DHTPublisher())
    if run_all or args.soil:
        services.append(SoilPublisher())
    try:
        for s in services:
            s.start()
        print("Services started. Ctrl+C to stop.")
        while True:
            time.sleep(2.0)
    except KeyboardInterrupt:
        print("Stopping...")
    finally:
        for s in services:
            try:
                s.stop()
            except Exception:
                pass

if __name__ == "__main__":
    main()
