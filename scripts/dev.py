"""Run the Python API and Vite together; Ctrl+C stops both child processes."""
from pathlib import Path
import signal
import subprocess
import sys
import time

root = Path(__file__).resolve().parents[1]
children = []

def stop(*_):
    for child in children:
        if child.poll() is None:
            child.terminate()
    for child in children:
        try:
            child.wait(timeout=5)
        except subprocess.TimeoutExpired:
            child.kill()
    raise SystemExit(0)

signal.signal(signal.SIGINT, stop)
signal.signal(signal.SIGTERM, stop)
try:
    children.append(subprocess.Popen([sys.executable, "-m", "uvicorn", "drivelab.api:app",
        "--host", "127.0.0.1", "--port", "8765", "--reload", "--reload-dir", "backend"], cwd=root))
    children.append(subprocess.Popen(["npm", "run", "dev"], cwd=root / "web"))
    print("DriveLab: http://127.0.0.1:5173 — API: http://127.0.0.1:8765", flush=True)
    while True:
        if any(child.poll() is not None for child in children):
            stop()
        time.sleep(.3)
finally:
    for child in children:
        if child.poll() is None:
            child.terminate()
