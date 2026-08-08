import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const port = Number(process.env.PORT || 4174);
const root = process.cwd();
const maxBodyBytes = 50_000;
const mimeTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' };

function send(response, status, body, type = 'application/json; charset=utf-8') {
  response.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' });
  response.end(typeof body === 'string' ? body : JSON.stringify(body));
}

function safeString(value, max = 900) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

function getRequestBody(request) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    request.on('data', chunk => {
      size += chunk.length;
      if (size > maxBodyBytes) { reject(new Error('Request is too large.')); request.destroy(); return; }
      chunks.push(chunk);
    });
    request.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { reject(new Error('Invalid JSON.')); } });
    request.on('error', reject);
  });
}

function textFromClaude(response) {
  return response.content?.find(part => part.type === 'text')?.text || '';
}

function parseRoute(text) {
  const raw = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
  const route = JSON.parse(raw);
  if (!route || typeof route !== 'object' || !Array.isArray(route.steps) || route.steps.length !== 3 || !route.guide || !route.agentPacket) throw new Error('Claude returned an incomplete route.');
  return route;
}

async function createRoute(input) {
  if (!process.env.ANTHROPIC_API_KEY || !process.env.CLAUDE_MODEL) throw new Error('Claude is not configured. Set ANTHROPIC_API_KEY and CLAUDE_MODEL before starting the server.');
  const signal = safeString(input.signal);
  if (!signal) throw new Error('Describe the situation before generating a route.');
  const context = safeString(input.context, 100);
  const format = safeString(input.format, 100);
  const focus = safeString(input.focus, 100);
  const intent = input.intent === 'offer' ? 'offer' : 'need';
  const system = `You are Bridgework's Route Maker. Bridgework helps people navigate the AI era through transition, community, and inclusive AI literacy. Turn one user's signal into a small, safe, practical collaboration route. Never claim to know, find, or introduce a real person. Instead describe the kind of guide, learner, or collaborator to seek. Never request private, client, health, financial, or identifying data. Keep plain language and preserve a human decision-maker. Return ONLY strict JSON matching this shape: {"headline":"string","guide":{"label":"string","description":"string"},"reason":"string","steps":[{"title":"string","detail":"string"},{"title":"string","detail":"string"},{"title":"string","detail":"string"}],"shareText":"string","agentPacket":{"mission":"string","goal":"string","agent_role":"string","human_decision_rights":["string"],"safety":["string"],"success":"string"}}. Keep every string concise. The agent role must be bounded, and its safety list must include no private data, cite sources, and flag uncertainty.`;
  const user = JSON.stringify({ intent, signal, context, preferredConnection: format, designLens: focus });
  const apiResponse = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: process.env.CLAUDE_MODEL, max_tokens: 900, temperature: 0.4, system, messages: [{ role: 'user', content: user }] })
  });
  const data = await apiResponse.json();
  if (!apiResponse.ok) throw new Error(data.error?.message || 'Claude could not generate a route right now.');
  return parseRoute(textFromClaude(data));
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  if (request.method === 'POST' && url.pathname === '/api/route') {
    try { send(response, 200, { ok: true, route: await createRoute(await getRequestBody(request)) }); }
    catch (error) { send(response, 400, { ok: false, error: error.message || 'Unable to generate a route.' }); }
    return;
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') { send(response, 405, { ok: false, error: 'Method not allowed.' }); return; }
  const pathname = url.pathname === '/' ? '/index.html' : url.pathname;
  const target = normalize(join(root, pathname));
  if (!target.startsWith(root)) { send(response, 403, 'Forbidden', 'text/plain; charset=utf-8'); return; }
  try {
    const file = await readFile(target);
    response.writeHead(200, { 'content-type': mimeTypes[extname(target)] || 'application/octet-stream', 'cache-control': 'no-store' });
    response.end(request.method === 'HEAD' ? undefined : file);
  } catch { send(response, 404, 'Not found', 'text/plain; charset=utf-8'); }
});

server.listen(port, () => console.log(`Bridgework is running at http://127.0.0.1:${port}`));
