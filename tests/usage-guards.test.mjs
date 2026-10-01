import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRateLimiter } from '../src/lib/rate-limit.ts';
import { assessUsage } from '../scripts/check-usage.ts';

const loadSource = (source) => import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
async function r2CoreModuleUrl() {
  const { stripTypeScriptTypes } = await import('node:module');
  const source = await readFile(new URL('../src/lib/r2.ts', import.meta.url), 'utf8');
  return 'data:text/javascript;base64,' + Buffer.from(stripTypeScriptTypes(source)).toString('base64');
}
async function r2MediaModuleUrl() {
  const { stripTypeScriptTypes } = await import('node:module');
  const source = await readFile(new URL('../src/lib/r2-media.ts', import.meta.url), 'utf8');
  return 'data:text/javascript;base64,' + Buffer.from(stripTypeScriptTypes(source)).toString('base64');
}
test('rate limiter bounds keys, denies excess requests, and expires windows', () => {
  const take = createRateLimiter(1);
  assert.equal(take('a', 2, 100, 0), true);
  assert.equal(take('a', 2, 100, 1), true);
  assert.equal(take('a', 2, 100, 2), false);
  assert.equal(take('b', 2, 100, 2), false);
  assert.equal(take('b', 2, 100, 100), true);
});
test('usage checker alerts at separate quotas, rejects stale or absent metrics', () => {
  const now = Date.now();
  const sample = { observedAt: new Date(now).toISOString(), logQueryGB: 1, uncachedEgressGB: 0.3, cachedEgressGB: 0 };
  assert.equal(assessUsage(sample, now).healthy, true);
  assert.deepEqual(assessUsage({ ...sample, logQueryGB: 47.556 }, now).alerts, ['logQueryGB']);
  assert.deepEqual(assessUsage({ ...sample, uncachedEgressGB: 4 }, now).alerts, ['uncachedEgressGB']);
  assert.throws(() => assessUsage({ ...sample, cachedEgressGB: null }, now));
  assert.throws(() => assessUsage(sample, now + 27 * 3600_000));
});
test('image failure uses the static placeholder and never schedules origin retries', async () => {
  const { stripTypeScriptTypes } = await import('node:module');
  const source = (await readFile(new URL('../src/lib/img.ts', import.meta.url), 'utf8'))
    .replace('"./r2-media"', JSON.stringify(await r2MediaModuleUrl()))
    .replace('"./r2"', JSON.stringify(await r2CoreModuleUrl()))
    .replace('import.meta.env.VITE_R2_PUBLIC_URL', JSON.stringify('/media'));
  const { imgFallback, toImg } = await loadSource(stripTypeScriptTypes(source));
  const el = { dataset: {}, removeAttribute() {}, src: '' };
  const old = 'https://frtzlibogmethppqmhtr.supabase.co/storage/v1/object/public/product-images/test.jpg';
  assert.match(toImg(old), /^\/media\?asset=/);
  imgFallback({ currentTarget: el }, old);
  assert.equal(el.src, '/placeholder.png');
  assert.equal(el.onerror, null);
  const first = el.src;
  imgFallback({ currentTarget: el }, old);
  assert.equal(el.src, first);
});
test('production logger is silent for all used levels', async () => {
  const { stripTypeScriptTypes } = await import('node:module');
  const source = (await readFile(new URL('../src/lib/logger.ts', import.meta.url), 'utf8')).replace('import.meta.env.DEV', 'false');
  const { logger } = await loadSource(stripTypeScriptTypes(source));
  for (const name of ['log', 'warn', 'error', 'info', 'debug']) assert.equal(logger[name]('test'), undefined);
});
test('missing R2 media never fetches Supabase and private buckets are denied', async () => {
  const { stripTypeScriptTypes } = await import('node:module');
  let source = await readFile(new URL('../src/routes/media.ts', import.meta.url), 'utf8');
  source = source.replace(/^import .*;\n/gm, '');
  source = `import { legacyMediaKey, legacyMediaBucket, safeMediaKey, PUBLIC_MEDIA_BUCKETS } from ${JSON.stringify(await r2MediaModuleUrl())};\n` +
    `import { readR2Image, R2_IMAGE_PLACEHOLDER } from ${JSON.stringify(await r2CoreModuleUrl())};\n` +
    'const createFileRoute = () => config => config; const getCloudflareR2Bucket = () => ({ get: async () => null });\n' + source;
  const { Route } = await loadSource(stripTypeScriptTypes(source));
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('Unexpected origin fetch'); };
  try {
    const missing = await Route.server.handlers.GET({ request: new Request('https://sheikhseeds.com/media?asset=product-images/missing.jpg') });
    assert.equal(missing.status, 302);
    assert.equal(missing.headers.get('Location'), '/placeholder.png');
    const legacy = await Route.server.handlers.GET({ request: new Request('https://sheikhseeds.com/media?src=' + encodeURIComponent('https://frtzlibogmethppqmhtr.supabase.co/storage/v1/object/public/private/test.jpg')) });
    assert.equal(legacy.status, 403);
  } finally { globalThis.fetch = originalFetch; }
});
