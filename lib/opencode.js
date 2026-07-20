const OPENCODE_URL = process.env.OPENCODE_URL || 'http://127.0.0.1:10001';

async function api(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${OPENCODE_URL}${path}`, opts);
  if (res.status === 204) return null;
  const text = await res.text();
  if (!res.ok) throw new Error(`OpenCode ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

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

async function sendMessageAsync(sessionId, text) {
  return api('POST', `/session/${sessionId}/prompt_async`, {
    parts: [{ type: 'text', text }],
  });
}

async function getMessages(sessionId, limit = 20) {
  return api('GET', `/session/${sessionId}/message?limit=${limit}`);
}

function extractResponse(data) {
  if (!data || !data.parts) return null;
  const text = data.parts
    .filter(p => p.type === 'text')
    .map(p => p.text)
    .join('');
  return text || null;
}

const SYSTEM_CTX = 'Voce e Hefestos, deus grego da forja e da tecnologia. Forjado para ajudar desenvolvedores a criar, depurar e entender codigo. Direto, conciso e profissional.';

async function sendWithContext(sessionId, text) {
  return api('POST', `/session/${sessionId}/message`, {
    system: SYSTEM_CTX,
    parts: [{ type: 'text', text }],
  });
}

module.exports = { setAuth, createSession, sendMessage, sendMessageAsync, getMessages, extractResponse, sendWithContext };
