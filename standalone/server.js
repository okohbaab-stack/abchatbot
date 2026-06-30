const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

try { const env = fs.readFileSync(path.join(__dirname, '.env'), 'utf8'); env.split('\n').forEach(l => { const m = l.match(/^([^=]+)=(.*)$/); if (m) process.env[m[1].trim()] = m[2].trim(); }); } catch (e) {}
try { const env = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8'); env.split('\n').forEach(l => { const m = l.match(/^([^=]+)=(.*)$/); if (m) process.env[m[1].trim()] = m[2].trim(); }); } catch (e) {}

const PORT = process.env.PORT || 5000;
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://xstwukfdkaawhnkoirw.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhzdHdrdWZka2RhYXdobmtvaXJ3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Mjg0ODc3MSwiZXhwIjoyMDk4NDI0NzcxfQ.rfCYLOIYZzOye7UNMzCPNPE_bLpR-HunvvrDHJcV_LE';
const SECRET = 'abchatbot_dev_secret_2024';

const tokenSign = (payload) => {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({ ...payload, iat: Date.now(), exp: Date.now() + 604800000 })).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
};
const tokenVerify = (token) => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const body = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    if (body.exp < Date.now()) return null;
    const sig = crypto.createHmac('sha256', SECRET).update(`${parts[0]}.${parts[1]}`).digest('base64url');
    if (sig !== parts[2]) return null;
    return body;
  } catch { return null; }
};
const hashPassword = (pw) => crypto.createHash('sha256').update(pw + SECRET).digest('hex');

const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const HF_TOKEN = process.env.HF_TOKEN || '';
const HF_URL = 'https://router.huggingface.co/v1/chat/completions';
const HF_MODEL = process.env.HF_MODEL || 'Qwen/Qwen2.5-7B-Instruct';

/* ---- Supabase REST Helpers ---- */

const SB = {
  headers: {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_KEY,
    'Authorization': 'Bearer ' + SUPABASE_KEY,
  },
  async get(table, query) {
    const url = SUPABASE_URL + '/rest/v1/' + table + '?' + (query || '');
    const res = await fetch(url, { headers: this.headers });
    if (!res.ok) throw new Error(`Supabase GET ${table}: ${res.status}`);
    return res.json();
  },
  async post(table, data) {
    const res = await fetch(SUPABASE_URL + '/rest/v1/' + table, {
      method: 'POST',
      headers: { ...this.headers, 'Prefer': 'return=representation' },
      body: JSON.stringify(data),
    });
    if (!res.ok) { const e = await res.text(); throw new Error(`Supabase POST: ${e}`); }
    return res.json();
  },
  async patch(table, query, data) {
    const res = await fetch(SUPABASE_URL + '/rest/v1/' + table + '?' + query, {
      method: 'PATCH',
      headers: { ...this.headers, 'Prefer': 'return=representation' },
      body: JSON.stringify(data),
    });
    if (!res.ok) { const e = await res.text(); throw new Error(`Supabase PATCH: ${e}`); }
    return res.json();
  },
  async delete(table, query) {
    const res = await fetch(SUPABASE_URL + '/rest/v1/' + table + '?' + query, {
      method: 'DELETE',
      headers: this.headers,
    });
    if (!res.ok) { const e = await res.text(); throw new Error(`Supabase DELETE: ${e}`); }
    return res.json();
  },
};

/* ---- AI ---- */

function formatMessages(messages) {
  return messages.map(m => {
    if (m.image) {
      const parts = [{ type: 'text', text: m.content || '' }];
      parts.push({ type: 'image_url', image_url: { url: m.image } });
      return { role: m.role, content: parts };
    }
    return { role: m.role, content: m.content };
  });
}

async function callOpenRouter(messages, model) {
  const apiMessages = formatMessages(messages);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENROUTER_KEY}`,
      'HTTP-Referer': 'http://localhost:5000',
      'X-Title': 'ABchatbot',
    },
    body: JSON.stringify({ model, messages: apiMessages, max_tokens: 4096 }),
    signal: controller.signal,
  });
  clearTimeout(timeout);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
  return data.choices?.[0]?.message?.content || '';
}

async function callHF(messages, model) {
  const apiMessages = formatMessages(messages);
  const hfModel = model || HF_MODEL;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  const res = await fetch(HF_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${HF_TOKEN}`,
    },
    body: JSON.stringify({ model: hfModel, messages: apiMessages, max_tokens: 4096 }),
    signal: controller.signal,
  });
  clearTimeout(timeout);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
  return data.choices?.[0]?.message?.content || '';
}

async function callAI(messages, model = 'openai/gpt-4o') {
  const last = messages[messages.length - 1];
  const text = last?.image ? '[Image attached] ' + (last?.content || '') : (last?.content || '');

  if (model === 'hf-free' && HF_TOKEN) {
    try { const r = await callHF(messages, HF_MODEL); if (r) return r; } catch (e) { return `Hugging Face Error: ${e.message}`; }
  }

  if (OPENROUTER_KEY) {
    try { const r = await callOpenRouter(messages, model); if (r) return r; } catch (e) {
      if (e.message && e.message.includes('Insufficient credits') && HF_TOKEN) console.log('OpenRouter: insufficient credits, falling back to Hugging Face');
      else if (HF_TOKEN) console.log('OpenRouter error: ' + e.message + ', falling back to Hugging Face');
      else return `API Error: ${e.message}`;
    }
  }

  if (HF_TOKEN) {
    try { const r = await callHF(messages, HF_MODEL); if (r) return r; } catch (e) { return `Hugging Face Error: ${e.message}`; }
  }

  return `[ABchatbot Offline]\n\n${text ? 'You said: "' + text.substring(0, 200) + '"' : ''}\n\nConfigure AI keys to enable responses.`;
}

/* ---- HTTP Server ---- */

function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => { try { resolve(JSON.parse(body)); } catch { resolve({}); } });
  });
}

function sendJSON(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,PATCH,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  });
  res.end(JSON.stringify(data));
}

function sendHTML(res, html) {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(html);
}

function serveStatic(res, filePath) {
  const ext = path.extname(filePath);
  const mime = {
    '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
    '.json': 'application/json', '.txt': 'text/plain',
  };
  try {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream' });
    res.end(content);
  } catch { sendJSON(res, 404, { error: 'File not found' }); }
}

async function getAuthUser(headers) {
  const auth = headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const payload = tokenVerify(auth.slice(7));
  if (!payload) return null;
  try {
    const users = await SB.get('users', 'select=*&id=eq.' + payload.id);
    return users[0] || null;
  } catch { return null; }
}

async function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;
  const method = req.method;

  if (method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,PATCH,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type,Authorization' });
    return res.end();
  }

  /* ---- Health ---- */
  if (pathname === '/api/health' && method === 'GET') {
    return sendJSON(res, 200, { status: 'ok', version: '1.0.0', name: 'ABchatbot' });
  }

  /* ---- Auth Routes ---- */

  if (pathname === '/api/auth/register' && method === 'POST') {
    const body = await parseBody(req);
    const { name, email, password } = body;
    if (!name || !email || !password) return sendJSON(res, 400, { error: 'All fields required' });
    try {
      const existing = await SB.get('users', 'select=id&email=eq.' + encodeURIComponent(email));
      if (existing.length > 0) return sendJSON(res, 400, { error: 'Email already registered' });
    } catch {}
    try {
      const user = {
        name, email,
        password: hashPassword(password),
        subscription: { plan: 'free', requestsUsed: 0, requestsLimit: 100, mediaGenerated: 0, mediaLimit: 10 },
      };
      const result = await SB.post('users', user);
      const u = Array.isArray(result) ? result[0] : result;
      const token = tokenSign({ id: u.id });
      const { password: _, ...safeUser } = u;
      return sendJSON(res, 201, { user: safeUser, accessToken: token });
    } catch (e) {
      return sendJSON(res, 500, { error: 'Registration failed: ' + e.message });
    }
  }

  if (pathname === '/api/auth/login' && method === 'POST') {
    const body = await parseBody(req);
    const { email, password } = body;
    try {
      const users = await SB.get('users', 'select=*&email=eq.' + encodeURIComponent(email));
      const user = users.find(u => u.password === hashPassword(password));
      if (!user) return sendJSON(res, 401, { error: 'Invalid credentials' });
      const token = tokenSign({ id: user.id });
      const { password: _, ...safeUser } = user;
      return sendJSON(res, 200, { user: safeUser, accessToken: token });
    } catch (e) {
      return sendJSON(res, 500, { error: 'Login failed' });
    }
  }

  if (pathname === '/api/auth/profile' && method === 'GET') {
    const user = await getAuthUser(req.headers);
    if (!user) return sendJSON(res, 401, { error: 'Not authenticated' });
    const { password: _, ...safeUser } = user;
    return sendJSON(res, 200, { user: safeUser });
  }

  /* ---- Chat Routes ---- */

  if (pathname === '/api/chat' && method === 'POST') {
    const user = await getAuthUser(req.headers);
    if (!user) return sendJSON(res, 401, { error: 'Not authenticated' });
    const body = await parseBody(req);
    try {
      const chat = {
        user_id: user.id,
        title: body.title || 'New Chat',
        messages: [],
        model: 'openai/gpt-4o',
        is_archived: false,
      };
      const result = await SB.post('chats', chat);
      const c = Array.isArray(result) ? result[0] : result;
      c._id = c.id;
      return sendJSON(res, 201, c);
    } catch (e) { return sendJSON(res, 500, { error: e.message }); }
  }

  if (pathname === '/api/chat' && method === 'GET') {
    const user = await getAuthUser(req.headers);
    if (!user) return sendJSON(res, 401, { error: 'Not authenticated' });
    try {
      const chats = await SB.get('chats', 'select=id,title,model,updated_at&user_id=eq.' + user.id + '&is_archived=eq.false&order=updated_at.desc');
      const mapped = chats.map(c => ({ _id: c.id, title: c.title, model: c.model, updatedAt: c.updated_at }));
      return sendJSON(res, 200, mapped);
    } catch (e) { return sendJSON(res, 500, { error: e.message }); }
  }

  const chatMatch = pathname.match(/^\/api\/chat\/([^/]+)$/);
  if (chatMatch && method === 'GET') {
    const user = await getAuthUser(req.headers);
    if (!user) return sendJSON(res, 401, { error: 'Not authenticated' });
    try {
      const chats = await SB.get('chats', 'select=*&id=eq.' + chatMatch[1] + '&user_id=eq.' + user.id);
      if (!chats[0]) return sendJSON(res, 404, { error: 'Chat not found' });
      const c = chats[0];
      c._id = c.id;
      c.messages = c.messages || [];
      return sendJSON(res, 200, c);
    } catch (e) { return sendJSON(res, 500, { error: e.message }); }
  }

  const msgMatch = pathname.match(/^\/api\/chat\/([^/]+)\/message$/);
  if (msgMatch && method === 'POST') {
    const user = await getAuthUser(req.headers);
    if (!user) return sendJSON(res, 401, { error: 'Not authenticated' });
    try {
      const chats = await SB.get('chats', 'select=*&id=eq.' + msgMatch[1] + '&user_id=eq.' + user.id);
      if (!chats[0]) return sendJSON(res, 404, { error: 'Chat not found' });
      const chat = chats[0];
      chat.messages = chat.messages || [];
      if (user.subscription.requestsUsed >= user.subscription.requestsLimit) {
        return sendJSON(res, 429, { error: 'Request limit reached' });
      }
      const body = await parseBody(req);
      const selectedModel = body.model || chat.model;

      const msg = { role: 'user', content: body.content || '', timestamp: new Date().toISOString() };
      if (body.image) msg.image = body.image;
      chat.messages.push(msg);

      const reply = await callAI(chat.messages, selectedModel);
      chat.messages.push({ role: 'assistant', content: reply, timestamp: new Date().toISOString() });

      const update = {
        messages: chat.messages,
        updated_at: new Date().toISOString(),
        model: selectedModel,
      };
      if (chat.title === 'New Chat' && body.content) update.title = body.content.substring(0, 60);

      await SB.patch('chats', 'id=eq.' + chat.id, update);
      user.subscription.requestsUsed += 1;
      await SB.patch('users', 'id=eq.' + user.id, { subscription: user.subscription });

      return sendJSON(res, 200, { reply, message: chat.messages[chat.messages.length - 1] });
    } catch (e) { return sendJSON(res, 500, { error: e.message }); }
  }

  if (chatMatch && method === 'DELETE') {
    const user = await getAuthUser(req.headers);
    if (!user) return sendJSON(res, 401, { error: 'Not authenticated' });
    try {
      await SB.delete('chats', 'id=eq.' + chatMatch[1] + '&user_id=eq.' + user.id);
      return sendJSON(res, 200, { message: 'Chat deleted' });
    } catch (e) { return sendJSON(res, 500, { error: e.message }); }
  }

  if (chatMatch && method === 'PATCH') {
    const user = await getAuthUser(req.headers);
    if (!user) return sendJSON(res, 401, { error: 'Not authenticated' });
    try {
      const chats = await SB.get('chats', 'select=id,is_archived&id=eq.' + chatMatch[1] + '&user_id=eq.' + user.id);
      if (!chats[0]) return sendJSON(res, 404, { error: 'Chat not found' });
      const c = chats[0];
      await SB.patch('chats', 'id=eq.' + c.id, { is_archived: !c.is_archived });
      return sendJSON(res, 200, { message: 'Toggled archive' });
    } catch (e) { return sendJSON(res, 500, { error: e.message }); }
  }

  /* ---- Media Routes ---- */

  if (pathname === '/api/media/generate/image' && method === 'POST') {
    const user = await getAuthUser(req.headers);
    if (!user) return sendJSON(res, 401, { error: 'Not authenticated' });
    const body = await parseBody(req);
    try {
      const record = { user_id: user.id, type: body.type || 'image', prompt: body.prompt, status: 'completed', url: '#', metadata: { format: 'json', modelUsed: 'openai/gpt-4o' } };
      const result = await SB.post('media', record);
      user.subscription.mediaGenerated += 1;
      await SB.patch('users', 'id=eq.' + user.id, { subscription: user.subscription });
      return sendJSON(res, 200, Array.isArray(result) ? result[0] : result);
    } catch (e) { return sendJSON(res, 500, { error: e.message }); }
  }

  if ((pathname === '/api/media/generate/document' || pathname === '/api/media/generate/video') && method === 'POST') {
    const user = await getAuthUser(req.headers);
    if (!user) return sendJSON(res, 401, { error: 'Not authenticated' });
    const body = await parseBody(req);
    const type = pathname.includes('video') ? 'video' : 'document';
    try {
      const record = { user_id: user.id, type, prompt: body.prompt, status: 'completed', url: '#', metadata: { format: 'text', modelUsed: 'openai/gpt-4o' } };
      const result = await SB.post('media', record);
      user.subscription.mediaGenerated += 1;
      await SB.patch('users', 'id=eq.' + user.id, { subscription: user.subscription });
      return sendJSON(res, 200, Array.isArray(result) ? result[0] : result);
    } catch (e) { return sendJSON(res, 500, { error: e.message }); }
  }

  if (pathname === '/api/media/history' && method === 'GET') {
    const user = await getAuthUser(req.headers);
    if (!user) return sendJSON(res, 401, { error: 'Not authenticated' });
    try {
      const items = await SB.get('media', 'select=*&user_id=eq.' + user.id + '&order=created_at.desc&limit=50');
      return sendJSON(res, 200, items);
    } catch (e) { return sendJSON(res, 500, { error: e.message }); }
  }

  /* ---- Serve Web App ---- */

  const standaloneDir = __dirname;
  const pwaFiles = ['/manifest.json', '/sw.js', '/icon-192.png', '/icon-512.png'];
  if (pwaFiles.includes(pathname)) {
    const filePath = path.join(standaloneDir, pathname.slice(1));
    if (fs.existsSync(filePath)) return serveStatic(res, filePath);
  }

  const webDir = path.join(__dirname, '..', 'web');
  if (pathname === '/' || pathname === '/index.html') {
    const htmlPath = path.join(webDir, 'index.html');
    if (fs.existsSync(htmlPath)) return serveStatic(res, htmlPath);
    const distPath = path.join(webDir, 'dist', 'index.html');
    if (fs.existsSync(distPath)) return serveStatic(res, distPath);
  }
  const staticPath = path.join(webDir, 'dist', pathname);
  if (fs.existsSync(staticPath)) return serveStatic(res, staticPath);

  sendHTML(res, getAppHTML());
}

const APP_HTML = fs.readFileSync(path.join(__dirname, 'app.html'), 'utf8');
function getAppHTML() { return APP_HTML; }

const server = http.createServer(handleRequest);
server.listen(PORT, '0.0.0.0', () => {
  const isRender = !!process.env.RENDER;
  console.log(isRender ? 'ABchatbot server started on port ' + PORT : `
╔══════════════════════════════════════════╗
║          ABchatbot Server v1.0           ║
║──────────────────────────────────────────║
║  Running at: http://localhost:${PORT}     ║
║  Data stored in Supabase (persistent)   ║
╚══════════════════════════════════════════╝`);
});
