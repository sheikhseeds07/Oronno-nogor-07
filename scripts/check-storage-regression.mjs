import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';

const root = process.cwd();
const nativeRequire = createRequire(import.meta.url);
let checks = 0;
function check(name, fn) { fn(); checks++; console.log(`PASS ${name}`); }
async function checkAsync(name, fn) { await fn(); checks++; console.log(`PASS ${name}`); }

function loader(overrides = {}) {
  const modules = new Map();
  const sandbox = {
    URL, URLSearchParams, Request, Response, Headers, File, Blob, FormData, Uint8Array,
    ArrayBuffer, ReadableStream, AbortSignal, TextEncoder, Promise,
    console: new Proxy({}, { get: () => () => { throw new Error('Unexpected runtime logging'); } }),
    fetch: () => { throw new Error('Unexpected network request'); },
    ...overrides.globals,
  };
  const context = vm.createContext(sandbox);
  function load(file) {
    const absolute = path.resolve(root, file);
    if (modules.has(absolute)) return modules.get(absolute).exports;
    const module = { exports: {} }; modules.set(absolute, module);
    const source = fs.readFileSync(absolute, 'utf8').replaceAll('import.meta.env.VITE_R2_PUBLIC_URL', JSON.stringify('/media'));
    const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    function require(id) {
      if (Object.hasOwn(overrides.imports ?? {}, id)) return overrides.imports[id];
      if (id === '@tanstack/react-router') return { createFileRoute: () => config => config };
      if (id.startsWith('@/')) return load(`src/${id.slice(2)}${/\.[cm]?[jt]sx?$/.test(id) ? '' : '.ts'}`);
      if (id.startsWith('.')) return load(path.relative(root, path.resolve(path.dirname(absolute), `${id}${/\.[cm]?[jt]sx?$/.test(id) ? '' : '.ts'}`)));
      return nativeRequire(id);
    }
    vm.runInContext(`(function(require,module,exports){${code}\n})`, context, { filename: absolute })(require, module, module.exports);
    return module.exports;
  }
  return { load, sandbox };
}

const { load } = loader();
const { validateR2PublicUrl } = load('src/lib/r2-config.ts');
const { safeMediaKey, legacyMediaKey } = load('src/lib/r2-media.ts');
const { toImg, imgFallback, IMAGE_PLACEHOLDER, safeImageSrcSet } = load('src/lib/img.ts');
const { retiredStorageResponse } = load('src/lib/retired-storage.ts');
const old = 'https://frtzlibogmethppqmhtr.supabase.co/storage/v1/object/sign/product-images/a%20b.webp?token=old-token';
const canonical = '/media?asset=product-images%2Fa%20b.webp';

check('missing/invalid R2 configuration fails before serving', () => {
  for (const value of [undefined, '', ' ', 'http://assets.test', 'https://frtzlibogmethppqmhtr.supabase.co', 'https://account.r2.cloudflarestorage.com', 'https://sheikhseeds.com', 'https://media.test?k=secret']) assert.throws(() => validateR2PublicUrl(value));
  assert.equal(validateR2PublicUrl('/media'), '/media');
  assert.equal(validateR2PublicUrl('https://media.example.test/'), 'https://media.example.test');
});
check('legacy URL and signed token become only an R2 asset key', () => {
  assert.equal(legacyMediaKey(old), 'product-images/a b.webp');
  assert.equal(toImg(old), canonical);
  assert.equal(toImg(`/media?src=${encodeURIComponent(old)}`), canonical);
  assert.equal(toImg(canonical), canonical);
  assert.equal(toImg('https://other.supabase.co/storage/v1/object/public/x/y'), IMAGE_PLACEHOLDER);
  assert.equal(toImg('javascript:alert(1)'), IMAGE_PLACEHOLDER);
});
check('traversal, malformed keys and private buckets never reach storage', () => {
  for (const key of ['private/file', 'product-images/../file', 'product-images//file', 'product-images/%2e%2e/file', 'product-images/a\\b', 'product-images/']) assert.equal(safeMediaKey(key), null);
  assert.equal(safeMediaKey('product-images/বাংলা ছবি.webp'), 'product-images/বাংলা ছবি.webp');
});
check('srcset cannot reintroduce a Storage request', () => {
  assert.equal(safeImageSrcSet(`${old} 400w, ${old} 800w`), `${canonical} 400w, ${canonical} 800w`);
});
check('image error replaces once, with no retry or timer', () => {
  let assignments = 0;
  const el = { dataset: {}, removeAttribute: () => {}, set src(value) { assignments++; assert.equal(value, IMAGE_PLACEHOLDER); } };
  for (let i = 0; i < 20; i++) imgFallback({ currentTarget: el }, old);
  assert.equal(assignments, 1);
});
check('storage fetch guard blocks only Storage, preserving DB/Auth/Functions', () => {
  assert.equal(retiredStorageResponse(old).status, 410);
  assert.equal(retiredStorageResponse(new Request(old)).status, 410);
  for (const pathname of ['/rest/v1/products', '/auth/v1/token', '/functions/v1/courier-history-bridge']) assert.equal(retiredStorageResponse(`https://frtzlibogmethppqmhtr.supabase.co${pathname}`), null);
});

function mediaHarness({ get, cache, binding = true }) {
  let pulls = 0;
  const bucket = { get: async key => { pulls++; return get(key); } };
  const l = loader({ imports: { '@/lib/cloudflare-r2.server': { getCloudflareR2Bucket: () => binding ? bucket : undefined } }, globals: cache ? { caches: { default: cache } } : {} });
  return { serve: request => l.load('src/routes/media.ts').Route.server.handlers.GET({ request }), pulls: () => pulls };
}
function req(key = 'product-images/missing.webp', headers) { return new Request(`https://sheikhseeds.com/media?asset=${encodeURIComponent(key)}`, { headers }); }
function memoryCache() {
  const map = new Map();
  return { match: async key => map.get(key.url)?.clone(), put: async (key, response) => { map.set(key.url, response.clone()); } };
}
await checkAsync('R2 miss returns cached 404 and never contacts Supabase', async () => {
  const h = mediaHarness({ get: () => null, cache: memoryCache() });
  assert.equal((await h.serve(req())).status, 404);
  const repeated = await h.serve(req());
  assert.equal(repeated.status, 404);
  assert.equal(repeated.headers.get('X-Oronno-Media-Cache'), 'HIT');
  assert.equal(h.pulls(), 1);
});
await checkAsync('R2 binding/read failure returns once without logging', async () => {
  const noBinding = mediaHarness({ get: () => null, binding: false });
  assert.equal((await noBinding.serve(req())).status, 503); assert.equal(noBinding.pulls(), 0);
  const failure = mediaHarness({ get: () => { throw new Error('R2 unavailable'); } });
  assert.equal((await failure.serve(req())).status, 503); assert.equal(failure.pulls(), 1);
});
await checkAsync('R2 success caches bytes and honors ETag', async () => {
  const h = mediaHarness({ cache: memoryCache(), get: key => {
    assert.equal(key, 'product-images/found.webp');
    return { body: new Response('image-bytes').body, httpEtag: '"r2-etag"', writeHttpMetadata: headers => headers.set('Content-Type', 'image/webp') };
  } });
  const result = await h.serve(req('product-images/found.webp'));
  assert.equal(await result.text(), 'image-bytes');
  assert.equal(result.headers.get('Cache-Control'), 'public, max-age=31536000, s-maxage=31536000, immutable');
  assert.equal((await h.serve(req('product-images/found.webp', { 'If-None-Match': '"r2-etag"' }))).status, 304);
  assert.equal(h.pulls(), 1);
});
await checkAsync('concurrent requests share one R2 read', async () => {
  let finish;
  const wait = new Promise(resolve => { finish = resolve; });
  const h = mediaHarness({ get: async () => { await wait; return { body: new Response('one').body }; } });
  const first = h.serve(req()); const second = h.serve(req());
  finish();
  assert.deepEqual((await Promise.all([first, second])).map(r => r.status), [200, 200]); assert.equal(h.pulls(), 1);
});
await checkAsync('invalid and legacy requests validate before one R2 read', async () => {
  const h = mediaHarness({ get: () => null });
  assert.equal((await h.serve(req('product-images/../secret'))).status, 400); assert.equal(h.pulls(), 0);
  assert.equal((await h.serve(new Request(`https://sheikhseeds.com/media?src=${encodeURIComponent(old)}`))).status, 404); assert.equal(h.pulls(), 1);
});
await checkAsync('retired backfill does no SDK or network work', async () => {
  const retired = load('src/routes/api/internal/r2-backfill.ts').Route.server.handlers;
  assert.equal(retired.GET().status, 410); assert.equal(retired.POST().status, 410);
});

function uploadHarness(put, head = async () => null) {
  const puts = [];
  const db = {
    auth: { getClaims: async () => ({ data: { claims: { sub: "demo-user" } }, error: null }) },
    from: table => { assert.equal(table, "user_roles"); return { select: fields => { assert.equal(fields, "role"); return { eq: async (field, user) => { assert.equal(field, "user_id"); assert.equal(user, "demo-user"); return { data: [{ role: "admin" }], error: null }; } }; } }; },
  };
  const bucket = { head, put: async (key, bytes, options) => { puts.push(key); return put(key, bytes, options); } };
  const l = loader({ imports: {
    '@/lib/cloudflare-r2.server': { getCloudflareR2Bucket: () => bucket },
    '@/lib/personal-supabase/client': { LIVE_DATABASE_URL: 'https://frtzlibogmethppqmhtr.supabase.co', LIVE_DATABASE_KEY: 'demo-publishable' },
    '@supabase/supabase-js': { createClient: (_url, _key, options) => { assert.equal(options.db.schema, 'public'); assert.equal(options.auth.debug, false); return db; } },
  } });
  return { post: request => l.load('src/routes/api/media/upload.ts').Route.server.handlers.POST({ request }), puts };
}
function uploadRequest({ authenticated = true, path = 'sample.webp' } = {}) {
  const form = new FormData(); form.set('bucket', 'product-images'); form.set('path', path);
  form.set('file', new File(['bytes'], 'sample.webp', { type: 'image/webp' }));
  return new Request('https://sheikhseeds.com/api/media/upload', { method: 'POST', headers: authenticated ? { Authorization: 'Bearer demo-token' } : {}, body: form });
}
await checkAsync('upload uses only R2 and returns a canonical media URL', async () => {
  const h = uploadHarness((key, bytes) => { assert.equal(key, 'product-images/sample.webp'); assert.equal(bytes.byteLength, 5); });
  const response = await h.post(uploadRequest()); assert.equal(response.status, 200);
  assert.equal((await response.json()).url, '/media?asset=product-images%2Fsample.webp'); assert.equal(h.puts.length, 1);
});
await checkAsync('failed R2 upload returns one 503 without runtime logging', async () => {
  const h = uploadHarness(() => { throw new Error('R2 unavailable'); });
  assert.equal((await h.post(uploadRequest())).status, 503); assert.equal(h.puts.length, 1);
});
await checkAsync('unauthenticated or unsafe upload never reaches R2', async () => {
  const h = uploadHarness(() => { throw new Error('Should not upload'); });
  assert.equal((await h.post(uploadRequest({ authenticated: false }))).status, 401);
  assert.equal((await h.post(uploadRequest({ path: '../unsafe.webp' }))).status, 400);
  assert.equal(h.puts.length, 0);
});
await checkAsync('all five retired Edge Functions respond without SDK/network activity', async () => {
  for (const slug of ['migrate-storage-assets', 'verify-storage-assets', 'recover-storage-assets', 'r2-source-proxy', 'r2-backfill-trigger']) {
    let handler;
    const edge = loader({ globals: { Deno: { serve: fn => { handler = fn; } } } });
    edge.load(`supabase/functions/${slug}/index.ts`);
    assert.equal((await handler(new Request('https://functions.test', { method: 'POST' }))).status, 410);
  }
});

function* allFiles(dir) { for (const entry of fs.readdirSync(dir, { withFileTypes: true })) { const name = path.join(dir, entry.name); if (entry.isDirectory()) yield* allFiles(name); else yield name; } }
check('every JSX image uses the failure guard; no active Storage SDK calls', () => {
  let wrapped = 0;
  for (const file of [...allFiles('src'), ...allFiles('supabase/functions'), ...allFiles('scripts')]) {
    if (!/\.[cm]?[jt]sx?$/.test(file) || file === 'scripts/check-storage-regression.mjs') continue;
    const source = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(source, /\.storage\s*(?:\.\s*from|\n\s*\.\s*from)|getPublicUrl\s*\(|createSignedUrl\s*\(/, file);
    if (file.endsWith('.tsx')) {
      const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      function visit(node) {
        if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
          const tag = node.tagName.getText(ast);
          if (tag === 'img') assert.equal(file, 'src/components/SafeImage.tsx', file);
          if (tag === 'SafeImage') wrapped++;
        }
        ts.forEachChild(node, visit);
      }
      visit(ast);
    }
  }
  assert.ok(wrapped > 0);
});
console.log(`${checks} Storage regression checks passed.`);
