const OPENCODE_URL = process.env.OPENCODE_URL || 'http://127.0.0.1:10001';

async function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${OPENCODE_URL}${path}`, opts);
  if (res.status === 204) return null;
  const text = await res.text();
  if (!res.ok) throw new Error(`OpenCode ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

const FALLBACK_PROMPT = 'Voce e Hefestos, deus grego da forja e da tecnologia. Forjado para ajudar desenvolvedores a criar, depurar e entender codigo. Direto, conciso e profissional.';

async function setAuth(provider, apiKey) {
  return api('PUT', `/auth/${provider}`, { type: 'api', key: apiKey });
}

async function createSession(title) {
  return api('POST', '/session', { title });
}

async function sendMessage(sessionId, text) {
  return api('POST', `/session/${sessionId}/message`, {
    parts: [{ type: 'text', text }],
  });
}

async function sendToBot(sessionId, systemPrompt, text) {
  return api('POST', `/session/${sessionId}/message`, {
    system: systemPrompt || FALLBACK_PROMPT,
    parts: [{ type: 'text', text }],
  });
}

function extractResponse(data) {
  if (!data?.parts) return null;
  return data.parts.filter(p => p.type === 'text').map(p => p.text).join('') || null;
}

async function sessionStats(sessionId) {
  return api('GET', `/session/${sessionId}`);
}

module.exports = { setAuth, createSession, sendMessage, sendToBot, extractResponse, sessionStats };
