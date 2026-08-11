export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Something went wrong</title>
<style>
  :root { color-scheme: light dark; }
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background:#fafafa; color:#111; }
  .card { max-width: 480px; padding: 2rem; text-align:center; }
  h1 { font-size: 1.5rem; margin: 0 0 .5rem; }
  p { color:#555; margin: 0 0 1.5rem; }
  .row { display:flex; gap:.5rem; justify-content:center; }
  button, a.btn { font: inherit; padding:.6rem 1rem; border-radius:.5rem; border:1px solid #ddd; background:#fff; color:#111; cursor:pointer; text-decoration:none; }
  button.primary { background:#111; color:#fff; border-color:#111; }
</style>
</head>
<body>
  <div class="card">
    <h1>Something went wrong</h1>
    <p>The page failed to load. Please try again.</p>
    <div class="row">
      <button class="primary" onclick="location.reload()">Refresh</button>
      <a class="btn" href="/">Go home</a>
    </div>
  </div>
</body>
</html>`;
}
