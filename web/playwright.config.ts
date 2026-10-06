import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  timeout: 120000,
  expect: { timeout: 45000 },
  use: { baseURL: 'http://127.0.0.1:8766', viewport: { width: 1440, height: 1080 }, trace: 'retain-on-failure' },
  webServer: {
    command: '.venv/bin/python scripts/verify_waymax.py --keep-fixture data/e2e-fixture.tfrecord && .venv/bin/python -m uvicorn drivelab.api:app --host 127.0.0.1 --port 8766',
    cwd: '..',
    url: 'http://127.0.0.1:8766/api/health',
    env: { DRIVELAB_DB: 'data/e2e.sqlite3', DRIVELAB_FORECAST_PATH: 'data/e2e-model.pt' },
    reuseExistingServer: false,
    timeout: 90000,
  },
  workers: 1,
  reporter: 'list',
});
