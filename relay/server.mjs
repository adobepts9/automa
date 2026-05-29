import http from 'http';
import { WebSocketServer } from 'ws';

const PORT = Number(process.env.PORT || 8787);
const RELAY_SECRET = process.env.RELAY_SECRET || '';

/** @type {Map<string, { ws: import('ws').WebSocket, deviceName: string, meta: object, lastSeen: number }>} */
const devices = new Map();

/** @type {Set<import('ws').WebSocket>} */
const dashboards = new Set();

function verifySecret(secret) {
  if (!RELAY_SECRET) {
    console.warn('[relay] RELAY_SECRET is not set — rejecting all clients');
    return false;
  }
  return typeof secret === 'string' && secret === RELAY_SECRET;
}

function listDevices() {
  return [...devices.entries()].map(([deviceId, entry]) => ({
    deviceId,
    deviceName: entry.deviceName,
    online: entry.ws.readyState === entry.ws.OPEN,
    lastSeen: entry.lastSeen,
    meta: entry.meta,
  }));
}

function broadcastDevices() {
  const payload = JSON.stringify({ type: 'devices', devices: listDevices() });
  dashboards.forEach((ws) => {
    if (ws.readyState === ws.OPEN) ws.send(payload);
  });
}

function sendJson(ws, data) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

function removeDevice(deviceId) {
  if (devices.delete(deviceId)) broadcastDevices();
}

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        ok: true,
        devices: devices.size,
        dashboards: dashboards.size,
      })
    );
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Automa cloud relay. Connect via WebSocket.');
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  let role = null;
  let deviceId = null;

  ws.on('message', (raw) => {
    let data;
    try {
      data = JSON.parse(String(raw));
    } catch {
      sendJson(ws, { type: 'error', error: 'invalid json' });
      return;
    }

    if (data.type === 'register') {
      if (!verifySecret(data.secret)) {
        sendJson(ws, { type: 'error', error: 'unauthorized' });
        ws.close(4401, 'unauthorized');
        return;
      }

      if (data.role === 'device') {
        if (!data.deviceId) {
          sendJson(ws, { type: 'error', error: 'deviceId required' });
          return;
        }

        role = 'device';
        deviceId = data.deviceId;

        const existing = devices.get(deviceId);
        if (existing && existing.ws !== ws) {
          existing.ws.close(4400, 'replaced');
        }

        devices.set(deviceId, {
          ws,
          deviceName: data.deviceName || '',
          meta: data.meta || {},
          lastSeen: Date.now(),
        });

        sendJson(ws, { type: 'registered', role: 'device', deviceId });
        broadcastDevices();
        return;
      }

      if (data.role === 'dashboard') {
        role = 'dashboard';
        dashboards.add(ws);
        sendJson(ws, { type: 'registered', role: 'dashboard' });
        sendJson(ws, { type: 'devices', devices: listDevices() });
        return;
      }

      sendJson(ws, { type: 'error', error: 'invalid role' });
      return;
    }

    if (data.type === 'ping') {
      if (role === 'device' && deviceId && devices.has(deviceId)) {
        const entry = devices.get(deviceId);
        entry.lastSeen = Date.now();
        if (data.meta) entry.meta = { ...entry.meta, ...data.meta };
      }
      sendJson(ws, { type: 'pong' });
      return;
    }

    if (data.type === 'request' && role === 'dashboard') {
      const target = devices.get(data.deviceId);
      if (!target || target.ws.readyState !== target.ws.OPEN) {
        sendJson(ws, {
          type: 'response',
          requestId: data.requestId,
          response: { ok: false, error: 'device offline' },
        });
        return;
      }

      sendJson(target.ws, {
        type: 'request',
        requestId: data.requestId,
        action: data.action,
        payload: data.payload || {},
      });
      return;
    }

    if (data.type === 'response' && role === 'device') {
      dashboards.forEach((dash) => {
        sendJson(dash, {
          type: 'response',
          requestId: data.requestId,
          deviceId,
          response: data.response,
        });
      });
      return;
    }

    sendJson(ws, { type: 'error', error: 'unknown message type' });
  });

  ws.on('close', () => {
    if (role === 'dashboard') {
      dashboards.delete(ws);
      return;
    }
    if (role === 'device' && deviceId) {
      const entry = devices.get(deviceId);
      if (entry && entry.ws === ws) removeDevice(deviceId);
    }
  });
});

setInterval(() => {
  const now = Date.now();
  devices.forEach((entry, id) => {
    if (entry.ws.readyState !== entry.ws.OPEN) {
      removeDevice(id);
      return;
    }
    if (now - entry.lastSeen > 120000) {
      entry.ws.close(4408, 'stale');
      removeDevice(id);
    }
  });
}, 30000);

server.listen(PORT, () => {
  console.log(`[relay] listening on :${PORT}`);
  if (!RELAY_SECRET) {
    console.warn('[relay] Set RELAY_SECRET env before production use');
  }
});
