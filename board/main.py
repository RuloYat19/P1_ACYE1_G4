#!/usr/bin/env python3
"""Lanza los scripts de sensores (temperatura y humedad de suelo) como procesos hijos.
Reinicia un proceso si falla y captura su salida para debug.
"""
import subprocess
import time
import signal
import sys
from pathlib import Path

SCRIPTS = [
    Path(__file__).parent / "lecturaTemperatura.py",
    Path(__file__).parent / "lecturaHumedadSuelo.py",
]

procs = []
running = True

def start_script(path: Path):
    print(f"Iniciando {path.name}...")
    return subprocess.Popen([sys.executable, str(path)], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)

def sigint_handler(signum, frame):
    global running
    print("Recibida señal de terminación, parando procesos...")
    running = False

signal.signal(signal.SIGINT, sigint_handler)
signal.signal(signal.SIGTERM, sigint_handler)

def tail_output(proc, name):
    if proc.stdout:
        line = proc.stdout.readline()
        if line:
            print(f"[{name}] {line.rstrip()}")

def main():
    for s in SCRIPTS:
        if not s.exists():
            print(f"Advertencia: {s} no existe. Saltando.")
            procs.append(None)
            continue
        procs.append(start_script(s))

    try:
        while running:
            for i, proc in enumerate(procs):
                if proc is None:
                    continue
                name = SCRIPTS[i].name
                ret = proc.poll()
                if ret is None:
                    tail_output(proc, name)
                else:
                    print(f"{name} termino con código {ret}. Reiniciando en 2s...")
                    proc = start_script(SCRIPTS[i])
                    procs[i] = proc
            time.sleep(0.1)
    finally:
        for proc in procs:
            if proc and proc.poll() is None:
                proc.terminate()
        time.sleep(0.5)
        for proc in procs:
            if proc and proc.poll() is None:
                proc.kill()

if __name__ == "__main__":
    main()
