// Static server for the scenes with HTTP Range support (audio seeking needs it). No API, no keys.
//   node qa/serve.mjs [port=41300]   ->  http://localhost:41300/demo/fire/index.html
// The QA and video scripts start it themselves when KINO_BASE is not set.
import {createServer} from 'node:http';
import {createReadStream, statSync, existsSync} from 'node:fs';
import {join, normalize, extname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const MIME = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.mp4': 'video/mp4',
  '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8'};

export function serve(port) {
  const server = createServer((req, res) => {
    let p = decodeURIComponent((req.url || '/').split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    p = normalize(join(ROOT, p));
    if (!p.startsWith(ROOT) || !existsSync(p) || statSync(p).isDirectory()) { res.writeHead(404).end('not found'); return; }
    const size = statSync(p).size, type = MIME[extname(p).toLowerCase()] || 'application/octet-stream', range = req.headers.range;
    const head = {'Content-Type': type, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache'};
    if (range) {
      const m = /bytes=(\d*)-(\d*)/.exec(range);
      let a = m && m[1] ? +m[1] : 0, b = m && m[2] ? +m[2] : size - 1;
      if (m && !m[1] && m[2]) { a = size - (+m[2]); b = size - 1; }
      if (a >= size || a > b) { res.writeHead(416, {'Content-Range': `bytes */${size}`}).end(); return; }
      res.writeHead(206, {...head, 'Content-Range': `bytes ${a}-${b}/${size}`, 'Content-Length': b - a + 1});
      createReadStream(p, {start: a, end: b}).pipe(res);
      return;
    }
    res.writeHead(200, {...head, 'Content-Length': size});
    if (req.method === 'HEAD') { res.end(); return; }
    createReadStream(p).pipe(res);
  });
  return new Promise((ok, fail) => { server.once('error', fail); server.listen(port, 'localhost', () => ok(server)); });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.argv[2] || 41300);
  await serve(port);
  console.log(`static: http://localhost:${port}/demo/fire/index.html`);
}
