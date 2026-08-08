export const config = { maxDuration: 15 };

function send(response, status, body) {
  response.status(status).json(body);
}

function safeString(value, max = 900) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

function parseRoute(text) {
  const raw = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
  const route = JSON.parse(raw);
  if (!route || typeof route !== 'object' || !Array.isArray(route.steps) || route.steps.length !== 3 || !route.guide || !route.agentPacket) throw new Error('Claude returned an incomplete route.');
  return route;
}

async function createRoute(input) {
  if (!process.env.ANTHROPIC_API_KEY || !process.env.CLAUDE_MODEL) throw new Error('Claude is not configured. Add ANTHROPIC_API_KEY and CLAUDE_MODEL in Vercel to enable personalized routes.');
  const signal = safeString(input.signal);
  if (!signal) throw new Error('Describe the situation before generating a route.');
  const context = safeString(input.context, 100);
  const format = safeString(input.format, 100);
  const focus = safeString(input.focus, 100);
  const intent = input.intent === 'offer' ? 'offer' : 'need';
  const system = `You are Bridgework's Route Maker. Bridgework helps people navigate the AI era through transition, community, and inclusive AI literacy. Turn one user's signal into a small, safe, practical collaboration route. Never claim to know, find, or introduce a real person. Instead describe the kind of guide, learner, or collaborator to seek. Never request private, client, health, financial, or identifying data. Keep plain language and preserve a human decision-maker. Return ONLY strict JSON matching this shape: {"headline":"string","guide":{"label":"string","description":"string"},"reason":"string","steps":[{"title":"string","detail":"string"},{"title":"string","detail":"string"},{"title":"string","detail":"string"}],"shareText":"string","agentPacket":{"mission":"string","goal":"string","agent_role":"string","human_decision_rights":["string"],"safety":["string"],"success":"string"}}. Keep every string concise. The agent role must be bounded, and its safety list must include no private data, cite sources, and flag uncertainty.`;
  const apiResponse = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: process.env.CLAUDE_MODEL, max_tokens: 900, temperature: 0.4, system, messages: [{ role: 'user', content: JSON.stringify({ intent, signal, context, preferredConnection: format, designLens: focus }) }] })
  });
  const data = await apiResponse.json();
  if (!apiResponse.ok) throw new Error(data.error?.message || 'Claude could not generate a route right now.');
  const text = data.content?.find(part => part.type === 'text')?.text || '';
  return parseRoute(text);
}

export default async function handler(request, response) {
  if (request.method !== 'POST') return send(response, 405, { ok: false, error: 'Method not allowed.' });
  try {
    const input = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
    return send(response, 200, { ok: true, route: await createRoute(input || {}) });
  } catch (error) {
    return send(response, 400, { ok: false, error: error.message || 'Unable to generate a route.' });
  }
}
