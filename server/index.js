// Servidor local: API REST para o painel + WebSocket para a tela de projecao.

import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { WebSocketServer } from 'ws';
import { BOOKS } from './books.js';
import { BibleError, getStructure, getVerses, listVersions, loadBible, search } from './bible.js';
import {
  clear,
  getSnapshot,
  initState,
  resetStyle,
  setBlank,
  setStyle,
  setVersesPerSlide,
  setVersion,
  show,
  step,
  subscribe,
} from './state.js';
import { parseReference } from './reference.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT ?? 3210);
const HOST = process.env.HOST ?? '127.0.0.1';

const app = express();
app.use(express.json());
app.use(express.static(join(ROOT, 'public')));

app.get('/projecao', (_req, res) => res.sendFile(join(ROOT, 'public', 'projecao.html')));

app.get('/api/versions', (_req, res) => res.json(listVersions()));

app.get('/api/books', (_req, res) => {
  res.json(BOOKS.map(({ id, abbrev, name, testament, order }) => ({ id, abbrev, name, testament, order })));
});

app.get('/api/structure', (req, res) => {
  res.json(getStructure(req.query.version ?? listVersions()[0].id));
});

app.get('/api/verses', (req, res) => {
  const { version, book, chapter, from, count, to } = req.query;
  const start = Number(from ?? 1);
  const size = to ? Number(to) - start + 1 : Number(count ?? 1);
  res.json(getVerses(version, book, Number(chapter ?? 1), start, size));
});

app.get('/api/reference', (req, res) => {
  const parsed = parseReference(req.query.q);
  if (!parsed) throw new BibleError(`Não entendi a referência "${req.query.q ?? ''}".`);
  const count = parsed.to ? parsed.to - parsed.from + 1 : Number(req.query.count ?? 1);
  res.json({ parsed, ...getVerses(req.query.version, parsed.bookId, parsed.chapter, parsed.from, count) });
});

app.get('/api/search', (req, res) => {
  res.json(search(req.query.version, req.query.q, Number(req.query.limit ?? 60)));
});

app.get('/api/state', (_req, res) => res.json(getSnapshot()));

// eslint-disable-next-line no-unused-vars -- o Express so reconhece o handler de erro com 4 argumentos
app.use((error, _req, res, _next) => {
  const status = error instanceof BibleError ? error.status : 500;
  if (status === 500) console.error(error);
  res.status(status).json({ error: error.message });
});

const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

function send(socket, snapshot) {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify({ type: 'state', payload: snapshot }));
  }
}

wss.on('connection', (socket) => {
  send(socket, getSnapshot());

  socket.on('message', (raw) => {
    let message;
    try {
      message = JSON.parse(raw.toString());
    } catch {
      return;
    }

    const { type, payload = {} } = message;
    try {
      switch (type) {
        case 'show': show(payload); break;
        case 'next': step(1); break;
        case 'prev': step(-1); break;
        case 'blank': setBlank(payload.value); break;
        case 'clear': clear(); break;
        case 'version': setVersion(payload.versionId); break;
        case 'versesPerSlide': setVersesPerSlide(payload.value); break;
        case 'style': setStyle(payload); break;
        case 'resetStyle': resetStyle(); break;
        case 'ping': send(socket, getSnapshot()); break;
        default: break;
      }
    } catch (error) {
      socket.send(JSON.stringify({ type: 'error', payload: { message: error.message } }));
    }
  });
});

// Cada mudanca de estado vai para todas as janelas abertas (paineis e projecoes).
subscribe((snapshot) => {
  for (const client of wss.clients) send(client, snapshot);
});

function lanAddress() {
  for (const addresses of Object.values(networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family === 'IPv4' && !address.internal) return address.address;
    }
  }
  return null;
}

try {
  const versions = await loadBible();
  await initState();
  server.listen(PORT, HOST, () => {
    const base = `http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`;
    console.log(`\n  BibleLinux no ar — ${versions.map((v) => v.shortName).join(', ')}`);
    console.log(`  Painel:    ${base}`);
    console.log(`  Projeção:  ${base}/projecao   (arraste para o projetor e tecle F11)`);
    if (HOST === '0.0.0.0') {
      const lan = lanAddress();
      if (lan) console.log(`  Na rede:   http://${lan}:${PORT}  (para controlar de outro aparelho)`);
    }
    console.log('');
  });
} catch (error) {
  console.error(`\n  ${error.message}\n`);
  process.exit(1);
}
