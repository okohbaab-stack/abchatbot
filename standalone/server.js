const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

try { const env = fs.readFileSync(path.join(__dirname, '.env'), 'utf8'); env.split('\n').forEach(l => { const m = l.match(/^([^=]+)=(.*)$/); if (m) process.env[m[1].trim()] = m[2].trim(); }); } catch (e) {}

const PORT = process.env.PORT || 5000;
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const CHATS_FILE = path.join(DATA_DIR, 'chats.json');
const MEDIA_FILE = path.join(DATA_DIR, 'media.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, '[]');
if (!fs.existsSync(CHATS_FILE)) fs.writeFileSync(CHATS_FILE, '[]');
if (!fs.existsSync(MEDIA_FILE)) fs.writeFileSync(MEDIA_FILE, '[]');

const readJSON = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJSON = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2));

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
const HF_MODEL = process.env.HF_MODEL || 'openai/gpt-oss-120b:fastest';

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

  // If user selected HF free model, go directly to Hugging Face
  if (model === 'hf-free' && HF_TOKEN) {
    try {
      const reply = await callHF(messages, HF_MODEL);
      if (reply) return reply;
    } catch (e) {
      return `Hugging Face Error: ${e.message}`;
    }
  }

  // Try OpenRouter first if key exists
  if (OPENROUTER_KEY) {
    try {
      const reply = await callOpenRouter(messages, model);
      if (reply) return reply;
    } catch (e) {
      if (e.message && e.message.includes('Insufficient credits') && HF_TOKEN) {
        console.log('OpenRouter: insufficient credits, falling back to Hugging Face');
      } else if (HF_TOKEN) {
        console.log('OpenRouter error: ' + e.message + ', falling back to Hugging Face');
      } else {
        return `API Error: ${e.message}`;
      }
    }
  }

  // Try Hugging Face if token exists
  if (HF_TOKEN) {
    try {
      const reply = await callHF(messages, HF_MODEL);
      if (reply) return reply;
    } catch (e) {
      return `Hugging Face Error: ${e.message}`;
    }
  }

  // Offline mode
  return `[ABchatbot Offline]

${text ? 'You said: "' + text.substring(0, 200) + '"' : ''}

To enable AI:
1. Get a free Hugging Face token at https://huggingface.co/settings/tokens
2. Add it to ABchatbot/standalone/.env as: HF_TOKEN=hf_your_token_here
3. Restart the server

Or add credits to OpenRouter at https://openrouter.ai/settings/credits`;
}

function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch { resolve({}); }
    });
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
  } catch {
    sendJSON(res, 404, { error: 'File not found' });
  }
}

function getAuthUser(headers) {
  const auth = headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const payload = tokenVerify(auth.slice(7));
  if (!payload) return null;
  const users = readJSON(USERS_FILE);
  return users.find(u => u.id === payload.id) || null;
}

async function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;
  const method = req.method;

  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,PATCH,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    });
    return res.end();
  }

  /* ---- API Routes ---- */

  // Health
  if (pathname === '/api/health' && method === 'GET') {
    return sendJSON(res, 200, { status: 'ok', version: '1.0.0', name: 'ABchatbot' });
  }

  // Register
  if (pathname === '/api/auth/register' && method === 'POST') {
    const body = await parseBody(req);
    const { name, email, password } = body;
    if (!name || !email || !password) return sendJSON(res, 400, { error: 'All fields required' });
    const users = readJSON(USERS_FILE);
    if (users.find(u => u.email === email)) return sendJSON(res, 400, { error: 'Email already registered' });
    const user = {
      id: crypto.randomUUID(),
      name, email,
      password: hashPassword(password),
      avatar: '',
      subscription: { plan: 'free', requestsUsed: 0, requestsLimit: 100, mediaGenerated: 0, mediaLimit: 10 },
      createdAt: new Date().toISOString(),
    };
    users.push(user);
    writeJSON(USERS_FILE, users);
    const token = tokenSign({ id: user.id });
    const { password: _, ...safeUser } = user;
    return sendJSON(res, 201, { user: safeUser, accessToken: token });
  }

  // Login
  if (pathname === '/api/auth/login' && method === 'POST') {
    const body = await parseBody(req);
    const { email, password } = body;
    const users = readJSON(USERS_FILE);
    const user = users.find(u => u.email === email && u.password === hashPassword(password));
    if (!user) return sendJSON(res, 401, { error: 'Invalid credentials' });
    const token = tokenSign({ id: user.id });
    const { password: _, ...safeUser } = user;
    return sendJSON(res, 200, { user: safeUser, accessToken: token });
  }

  // Profile
  if (pathname === '/api/auth/profile' && method === 'GET') {
    const user = getAuthUser(req.headers);
    if (!user) return sendJSON(res, 401, { error: 'Not authenticated' });
    const { password: _, ...safeUser } = user;
    return sendJSON(res, 200, { user: safeUser });
  }

  // Create chat
  if (pathname === '/api/chat' && method === 'POST') {
    const user = getAuthUser(req.headers);
    if (!user) return sendJSON(res, 401, { error: 'Not authenticated' });
    const body = await parseBody(req);
    const chat = {
      id: crypto.randomUUID(),
      userId: user.id,
      title: body.title || 'New Chat',
      messages: [],
      model: 'openai/gpt-4o',
      isArchived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const chats = readJSON(CHATS_FILE);
    chats.push(chat);
    writeJSON(CHATS_FILE, chats);
    chat._id = chat.id;
    return sendJSON(res, 201, chat);
  }

  // List chats
  if (pathname === '/api/chat' && method === 'GET') {
    const user = getAuthUser(req.headers);
    if (!user) return sendJSON(res, 401, { error: 'Not authenticated' });
    const chats = readJSON(CHATS_FILE)
      .filter(c => c.userId === user.id && !c.isArchived)
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .map(({ id, title, model, updatedAt }) => ({ _id: id, title, model, updatedAt }));
    return sendJSON(res, 200, chats);
  }

  // Get single chat
  const chatMatch = pathname.match(/^\/api\/chat\/([^/]+)$/);
  if (chatMatch && method === 'GET') {
    const user = getAuthUser(req.headers);
    if (!user) return sendJSON(res, 401, { error: 'Not authenticated' });
    const chats = readJSON(CHATS_FILE);
    const chat = chats.find(c => c.id === chatMatch[1] && c.userId === user.id);
    if (!chat) return sendJSON(res, 404, { error: 'Chat not found' });
    chat._id = chat.id;
    return sendJSON(res, 200, chat);
  }

  // Send message
  const msgMatch = pathname.match(/^\/api\/chat\/([^/]+)\/message$/);
  if (msgMatch && method === 'POST') {
    const user = getAuthUser(req.headers);
    if (!user) return sendJSON(res, 401, { error: 'Not authenticated' });
    const chats = readJSON(CHATS_FILE);
    const chat = chats.find(c => c.id === msgMatch[1] && c.userId === user.id);
    if (!chat) return sendJSON(res, 404, { error: 'Chat not found' });
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
    chat.updatedAt = new Date().toISOString();
    if (chat.title === 'New Chat' && body.content) chat.title = body.content.substring(0, 60);
    chat.model = selectedModel;
    writeJSON(CHATS_FILE, chats);
    const users = readJSON(USERS_FILE);
    const uIdx = users.findIndex(u => u.id === user.id);
    if (uIdx >= 0) { users[uIdx].subscription.requestsUsed += 1; writeJSON(USERS_FILE, users); }
    return sendJSON(res, 200, { reply, message: chat.messages[chat.messages.length - 1] });
  }

  // Delete chat
  if (chatMatch && method === 'DELETE') {
    const user = getAuthUser(req.headers);
    if (!user) return sendJSON(res, 401, { error: 'Not authenticated' });
    let chats = readJSON(CHATS_FILE);
    const idx = chats.findIndex(c => c.id === chatMatch[1] && c.userId === user.id);
    if (idx === -1) return sendJSON(res, 404, { error: 'Chat not found' });
    chats.splice(idx, 1);
    writeJSON(CHATS_FILE, chats);
    return sendJSON(res, 200, { message: 'Chat deleted' });
  }

  // Archive chat
  if (chatMatch && method === 'PATCH') {
    const user = getAuthUser(req.headers);
    if (!user) return sendJSON(res, 401, { error: 'Not authenticated' });
    const chats = readJSON(CHATS_FILE);
    const chat = chats.find(c => c.id === chatMatch[1] && c.userId === user.id);
    if (!chat) return sendJSON(res, 404, { error: 'Chat not found' });
    chat.isArchived = !chat.isArchived;
    writeJSON(CHATS_FILE, chats);
    return sendJSON(res, 200, chat);
  }

  // Generate media
  if (pathname === '/api/media/generate/image' && method === 'POST') {
    const user = getAuthUser(req.headers);
    if (!user) return sendJSON(res, 401, { error: 'Not authenticated' });
    const body = await parseBody(req);
    const media = {
      id: crypto.randomUUID(),
      userId: user.id, type: body.type || 'image', prompt: body.prompt,
      status: 'completed', url: '#', createdAt: new Date().toISOString(),
      metadata: { format: 'json', modelUsed: 'openai/gpt-4o' },
    };
    const allMedia = readJSON(MEDIA_FILE);
    allMedia.push(media);
    writeJSON(MEDIA_FILE, allMedia);
    const users = readJSON(USERS_FILE);
    const uIdx = users.findIndex(u => u.id === user.id);
    if (uIdx >= 0) { users[uIdx].subscription.mediaGenerated += 1; writeJSON(USERS_FILE, users); }
    return sendJSON(res, 200, media);
  }
  if ((pathname === '/api/media/generate/document' || pathname === '/api/media/generate/video') && method === 'POST') {
    const user = getAuthUser(req.headers);
    if (!user) return sendJSON(res, 401, { error: 'Not authenticated' });
    const body = await parseBody(req);
    const type = pathname.includes('video') ? 'video' : 'document';
    const media = {
      id: crypto.randomUUID(),
      userId: user.id, type, prompt: body.prompt,
      status: 'completed', url: '#', createdAt: new Date().toISOString(),
      metadata: { format: 'text', modelUsed: 'openai/gpt-4o' },
    };
    const allMedia = readJSON(MEDIA_FILE);
    allMedia.push(media);
    writeJSON(MEDIA_FILE, allMedia);
    const users = readJSON(USERS_FILE);
    const uIdx = users.findIndex(u => u.id === user.id);
    if (uIdx >= 0) { users[uIdx].subscription.mediaGenerated += 1; writeJSON(USERS_FILE, users); }
    return sendJSON(res, 200, media);
  }

  // Media history
  if (pathname === '/api/media/history' && method === 'GET') {
    const user = getAuthUser(req.headers);
    if (!user) return sendJSON(res, 401, { error: 'Not authenticated' });
    const allMedia = readJSON(MEDIA_FILE).filter(m => m.userId === user.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 50);
    return sendJSON(res, 200, allMedia);
  }

  /* ---- Serve Web App ---- */
  // Serve PWA files from standalone directory
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

  // Fallback: serve inline HTML app
  sendHTML(res, getAppHTML());
}

// Inline HTML app (so it works even without web dependencies)
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
║  No dependencies required!               ║
╚══════════════════════════════════════════╝`);
});
