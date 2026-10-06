import { expect, test } from '@playwright/test';
import { PerspectiveCamera, Vector3 } from 'three';

test('3D uses local models, shared replay/selection, camera controls and mobile layout', async ({ page }) => {
  const errors: string[] = [], modelRequests: string[] = [];
  let runs = 0;
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.url().includes('/models/kenney/') && response.status() === 200) modelRequests.push(response.url()); });
  page.on('request', request => { if (request.method() === 'POST' && request.url().endsWith('/api/runs')) runs++; });
  await page.goto('/');
  const scene = page.getByTestId('scene-3d');
  await expect(scene).toHaveAttribute('data-renderer', 'webgl');
  await expect(scene).toHaveAttribute('data-models', /sedan-sports/);
  await expect(scene).toHaveAttribute('data-models', /sedan(?:,|$)/);
  await expect(page.locator('.frame-count')).not.toHaveText('Frame 0 / 0');
  expect(modelRequests.some(url => url.endsWith('/Textures/colormap.png'))).toBeTruthy();
  // Raycast the rendered model, not only the accessible inspector shortcuts.
  const box = (await scene.locator('canvas').boundingBox())!;
  const camera = new PerspectiveCamera(42, box.width / box.height, .1, 5000);
  camera.position.set(10 - 38 * .48, 38 * .92, 38 * .75);
  camera.lookAt(10, 0, 0); camera.updateMatrixWorld();
  const projected = new Vector3(0, .8, 0).project(camera);
  await page.mouse.click(box.x + (projected.x + 1) * box.width / 2, box.y + (1 - projected.y) * box.height / 2);
  await expect(page.getByRole('heading', { name: 'Ego vehicle', exact: true })).toBeVisible();
  await page.getByLabel('Replay timeline').fill('20');
  await page.getByRole('button', { name: 'Select ego vehicle', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Ego vehicle', exact: true })).toBeVisible();
  await page.locator('.candidate-item').nth(1).click();
  await expect(page.getByRole('heading', { name: 'Inspected candidate' })).toBeVisible();
  const before = runs;
  await page.getByRole('button', { name: '2D debug', exact: true }).click();
  await expect(page.locator('svg.road-canvas')).toBeVisible();
  await expect(page.locator('.time-display strong')).toHaveText('2.0s');
  await page.getByRole('button', { name: '3D replay', exact: true }).click();
  await expect(scene).toHaveAttribute('data-models', /sedan-sports/);
  await expect(page.locator('.time-display strong')).toHaveText('2.0s');
  await expect(page.getByRole('heading', { name: 'Inspected candidate' })).toBeVisible();
  expect(runs).toBe(before);
  for (const [label, value] of [['Top-down', 'top'], ['Chase', 'chase'], ['Angled', 'angled']]) {
    await page.getByRole('button', { name: label, exact: true }).click();
    await expect(scene).toHaveAttribute('data-camera', value);
  }
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await page.getByRole('button', { name: 'Zoom out', exact: true }).click();
  await page.getByRole('button', { name: 'Reset view', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Follow ego vehicle', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: 'Follow ego vehicle', exact: true }).click();
  await page.getByLabel('Inspect traffic actor').selectOption('parked');
  await expect(page.getByRole('heading', { name: 'Actor parked', exact: true })).toBeVisible();
  await page.getByLabel('Candidate paths', { exact: true }).uncheck();
  await expect(page.locator('.legend-rejected')).toHaveCount(0);
  await page.getByLabel('Traffic forecasts', { exact: true }).uncheck();
  await expect(page.locator('.legend-forecast')).toHaveCount(0);
  await page.getByLabel('Candidate paths', { exact: true }).check();
  await page.getByLabel('Traffic forecasts', { exact: true }).check();
  await page.getByRole('button', { name: 'Play replay', exact: true }).click();
  await expect(page.locator('.time-display strong')).not.toHaveText('2.0s');
  await page.getByRole('button', { name: 'Pause replay', exact: true }).click();
  await page.getByLabel('Replay timeline').fill('39');
  await page.screenshot({ path: 'test-results/replay-3d-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(scene.locator('canvas')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.getByRole('button', { name: 'Top-down', exact: true }).click();
  await page.screenshot({ path: 'test-results/replay-3d-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1080 });
  await page.locator('[data-scenario-id="curved-road"]').click();
  await expect(page.getByRole('heading', { name: 'Sweeping bend', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Run planner', exact: true })).toBeEnabled();
  await expect(scene).toHaveAttribute('data-models', /sedan-sports/);
  await page.getByLabel('Replay timeline').fill('30');
  await page.screenshot({ path: 'test-results/replay-3d-curved.png', fullPage: true });
  await page.locator('[data-scenario-id="slow-lead"]').click();
  await expect(page.getByRole('button', { name: 'Run planner', exact: true })).toBeEnabled();
  await expect(scene).toHaveAttribute('data-models', /sedan-sports/);
  expect(errors).toEqual([]);
});

test('failed model loads keep a working 3D scene and 2D remains selectable', async ({ page }) => {
  await page.route('**/models/kenney/*.glb', route => route.abort());
  await page.goto('/');
  await expect(page.locator('.scene-3d-note')).toContainText('Model unavailable · simplified vehicles');
  await expect(page.getByTestId('scene-3d')).toHaveAttribute('data-renderer', 'webgl');
  await page.getByRole('button', { name: 'Select ego vehicle', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Ego vehicle', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '2D debug', exact: true }).click();
  await expect(page.locator('svg.road-canvas')).toBeVisible();
});

test('unavailable WebGL falls back to the original replay', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, kind: string, ...args: unknown[]) {
      if (kind === 'webgl' || kind === 'webgl2') return null;
      return original.apply(this, [kind, ...args] as Parameters<typeof original>);
    } as typeof original;
  });
  await page.goto('/');
  await expect(page.getByText('3D unavailable. The 2D replay still works.', { exact: true })).toBeVisible();
  await expect(page.locator('svg.road-canvas')).toBeVisible();
  await page.getByRole('button', { name: 'Next frame', exact: true }).click();
  await expect(page.locator('.time-display strong')).toHaveText('0.1s');
});

test('a lost graphics context switches to 2D without losing the frame', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('scene-3d')).toHaveAttribute('data-models', /sedan-sports/);
  await expect(page.getByRole('button', { name: 'Run planner', exact: true })).toBeEnabled();
  await page.getByLabel('Replay timeline').fill('10');
  const lost = await page.locator('canvas').evaluate(canvas => {
    const gl = (canvas as HTMLCanvasElement).getContext('webgl2');
    const extension = gl?.getExtension('WEBGL_lose_context');
    if (!extension) return false;
    extension.loseContext(); return true;
  });
  expect(lost).toBeTruthy();
  await expect(page.getByRole('button', { name: '2D debug', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('svg.road-canvas')).toBeVisible();
  await expect(page.locator('.time-display strong')).toHaveText('1.0s');
});
