import json
from pathlib import Path
import sqlite3
import zlib
from contextlib import contextmanager

from .scenarios import ScenarioData


class Store:
    def __init__(self, path):
        self.path = str(path)
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as db:
            db.execute("PRAGMA journal_mode=WAL")
            db.execute("CREATE TABLE IF NOT EXISTS runs (id TEXT PRIMARY KEY, created_at TEXT NOT NULL, report TEXT NOT NULL)")
            db.execute("CREATE TABLE IF NOT EXISTS scenarios (id TEXT PRIMARY KEY, payload TEXT NOT NULL)")
            db.execute("CREATE TABLE IF NOT EXISTS evaluations (id TEXT PRIMARY KEY, payload TEXT NOT NULL)")

    @contextmanager
    def connect(self):
        connection = sqlite3.connect(self.path, timeout=30.)
        try:
            with connection:
                yield connection
        finally:
            connection.close()

    def save_run(self, report):
        # Lossless compression keeps candidate-heavy full replays inexpensive.
        payload = b"DLZ1" + zlib.compress(json.dumps(report, allow_nan=False).encode(), level=6)
        with self.connect() as db:
            db.execute("INSERT INTO runs VALUES (?, ?, ?)", (report["id"], report["created_at"], payload))

    @staticmethod
    def decode_run(payload):
        if isinstance(payload, bytes) and payload.startswith(b"DLZ1"):
            payload = zlib.decompress(payload[4:])
        return json.loads(payload)

    @staticmethod
    def summarize_run(report):
        return {key: value for key, value in report.items() if key != "frames"}

    def get_run(self, id):
        with self.connect() as db:
            row = db.execute("SELECT report FROM runs WHERE id=?", (id,)).fetchone()
        return self.decode_run(row[0]) if row else None

    def list_runs(self, limit=50):
        with self.connect() as db:
            rows = db.execute("SELECT report FROM runs ORDER BY created_at DESC LIMIT ?", (limit,)).fetchall()
        summaries = []
        for row in rows:
            report = self.decode_run(row[0])
            summaries.append(self.summarize_run(report))
        return summaries

    def save_scenarios(self, scenarios):
        with self.connect() as db:
            for scenario in scenarios:
                db.execute("INSERT OR REPLACE INTO scenarios VALUES (?, ?)",
                           (scenario.public["id"], json.dumps(scenario.serialize(), allow_nan=False)))

    def load_scenarios(self):
        with self.connect() as db:
            rows = db.execute("SELECT payload FROM scenarios").fetchall()
        return [ScenarioData(**json.loads(row[0])) for row in rows]

    def save_evaluation(self, evaluation):
        with self.connect() as db:
            db.execute("INSERT INTO evaluations VALUES (?, ?)", (evaluation["id"], json.dumps(evaluation, allow_nan=False)))

    def get_evaluation(self, id):
        with self.connect() as db:
            row = db.execute("SELECT payload FROM evaluations WHERE id=?", (id,)).fetchone()
        return json.loads(row[0]) if row else None
