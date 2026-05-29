const REQUEST_SOURCE = 'remote-automa-dashboard';
const REQUEST_TYPE = 'REMOTE_AUTOMA_REQUEST';
const RESPONSE_SOURCE = 'remote-automa-extension';
const RESPONSE_TYPE = 'REMOTE_AUTOMA_RESPONSE';
const READY_TYPE = 'REMOTE_AUTOMA_READY';

const STORAGE_RELAY_URL = 'relayUrl';
const STORAGE_RELAY_SECRET = 'relaySecret';

const relayUrlInput = document.getElementById('relayUrlInput');
const relaySecretInput = document.getElementById('relaySecretInput');
const relayStatus = document.getElementById('relayStatus');
const devicesEl = document.getElementById('devices');
const selectedDeviceEl = document.getElementById('selectedDevice');
const statusOutput = document.getElementById('statusOutput');
const runOutput = document.getElementById('runOutput');
const workflowsEl = document.getElementById('workflows');
const bridgeStatus = document.getElementById('bridgeStatus');

const workflowIdInput = document.getElementById('workflowIdInput');
const payloadInput = document.getElementById('payloadInput');
const waitInput = document.getElementById('waitInput');
const timeoutInput = document.getElementById('timeoutInput');

const localPendingRequests = new Map();
const cloudPendingRequests = new Map();

let relaySocket = null;
let selectedDeviceId = '';
let devices = [];

const REQUEST_TIMEOUT_MS = 30000;

function pretty(value) {
  return JSON.stringify(value, null, 2);
}

function normalizeRelayUrl(url = '') {
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('ws://') || trimmed.startsWith('wss://')) return trimmed;
  if (trimmed.startsWith('http://')) return trimmed.replace('http://', 'ws://');
  if (trimmed.startsWith('https://')) return trimmed.replace('https://', 'wss://');
  return `wss://${trimmed}`;
}

function saveRelayConfig() {
  localStorage.setItem(STORAGE_RELAY_URL, relayUrlInput.value.trim());
  localStorage.setItem(STORAGE_RELAY_SECRET, relaySecretInput.value.trim());
}

function loadRelayConfig() {
  relayUrlInput.value = localStorage.getItem(STORAGE_RELAY_URL) || '';
  relaySecretInput.value = localStorage.getItem(STORAGE_RELAY_SECRET) || '';
}

function setRelayStatus(text) {
  relayStatus.textContent = text;
}

function setSelectedDevice(deviceId) {
  selectedDeviceId = deviceId;
  const device = devices.find((item) => item.deviceId === deviceId);
  selectedDeviceEl.textContent = device
    ? `${device.deviceName || device.deviceId} (${device.online ? 'online' : 'offline'})`
    : deviceId || 'none';
}

function renderDevices() {
  devicesEl.innerHTML = '';
  if (!devices.length) {
    devicesEl.innerHTML = '<div class="device-item">No devices online.</div>';
    return;
  }

  devices.forEach((device) => {
    const card = document.createElement('div');
    card.className = `device-item${device.deviceId === selectedDeviceId ? ' active' : ''}`;
    card.innerHTML = `
      <div class="device-name">${device.deviceName || '(unnamed device)'}</div>
      <div class="device-meta">id: ${device.deviceId}</div>
      <div class="device-meta">status: ${device.online ? 'online' : 'offline'}</div>
      <div class="device-meta">last seen: ${device.lastSeen ? new Date(device.lastSeen).toLocaleString() : '-'}</div>
    `;
    card.addEventListener('click', () => {
      setSelectedDevice(device.deviceId);
      renderDevices();
    });
    devicesEl.appendChild(card);
  });
}

function connectRelay() {
  saveRelayConfig();

  const relayUrl = normalizeRelayUrl(relayUrlInput.value);
  const relaySecret = relaySecretInput.value.trim();

  if (!relayUrl || !relaySecret) {
    setRelayStatus('missing url/secret');
    return;
  }

  if (relaySocket) {
    relaySocket.close();
    relaySocket = null;
  }

  setRelayStatus('connecting...');
  const socket = new WebSocket(relayUrl);
  relaySocket = socket;

  socket.addEventListener('open', () => {
    socket.send(
      JSON.stringify({
        type: 'register',
        role: 'dashboard',
        secret: relaySecret,
      })
    );
  });

  socket.addEventListener('message', (event) => {
    let data;
    try {
      data = JSON.parse(event.data);
    } catch {
      return;
    }

    if (data.type === 'registered') {
      setRelayStatus('connected');
      return;
    }

    if (data.type === 'devices') {
      devices = data.devices || [];
      renderDevices();
      if (
        selectedDeviceId &&
        !devices.some((item) => item.deviceId === selectedDeviceId)
      ) {
        setSelectedDevice('');
      }
      return;
    }

    if (data.type === 'error') {
      setRelayStatus(data.error || 'error');
      return;
    }

    if (data.type === 'response' && data.requestId) {
      const pending = cloudPendingRequests.get(data.requestId);
      if (!pending) return;

      clearTimeout(pending.timeout);
      cloudPendingRequests.delete(data.requestId);

      if (data.response?.ok) pending.resolve(data.response.result);
      else pending.reject(new Error(data.response?.error || 'Unknown error'));
    }
  });

  socket.addEventListener('close', () => {
    setRelayStatus('disconnected');
    relaySocket = null;
  });

  socket.addEventListener('error', () => {
    setRelayStatus('connection error');
  });
}

function requestCloud(action, payload = {}) {
  if (!relaySocket || relaySocket.readyState !== WebSocket.OPEN) {
    return Promise.reject(new Error('Relay not connected'));
  }
  if (!selectedDeviceId) {
    return Promise.reject(new Error('Select a device first'));
  }

  const requestId = crypto.randomUUID();

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cloudPendingRequests.delete(requestId);
      reject(new Error('Request timeout'));
    }, REQUEST_TIMEOUT_MS);

    cloudPendingRequests.set(requestId, { resolve, reject, timeout });

    relaySocket.send(
      JSON.stringify({
        type: 'request',
        deviceId: selectedDeviceId,
        requestId,
        action,
        payload,
      })
    );
  });
}

function requestLocal(action, payload = {}) {
  const requestId = crypto.randomUUID();

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      localPendingRequests.delete(requestId);
      reject(new Error('Request timeout'));
    }, REQUEST_TIMEOUT_MS);

    localPendingRequests.set(requestId, { resolve, reject, timeout });

    window.postMessage(
      {
        source: REQUEST_SOURCE,
        type: REQUEST_TYPE,
        requestId,
        action,
        payload,
        origin: window.location.origin,
      },
      window.location.origin
    );
  });
}

function requestDevice(action, payload = {}) {
  if (relaySocket && relaySocket.readyState === WebSocket.OPEN && selectedDeviceId) {
    return requestCloud(action, payload);
  }
  return requestLocal(action, payload);
}

window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  const data = event.data;
  if (!data || data.source !== RESPONSE_SOURCE) return;

  if (data.type === READY_TYPE) {
    bridgeStatus.textContent = 'ready';
    return;
  }

  if (data.type !== RESPONSE_TYPE || !data.requestId) return;

  const req = localPendingRequests.get(data.requestId);
  if (!req) return;

  clearTimeout(req.timeout);
  localPendingRequests.delete(data.requestId);

  if (data.response?.ok) req.resolve(data.response.result);
  else req.reject(new Error(data.response?.error || 'Unknown error'));
});

function renderWorkflows(items = []) {
  workflowsEl.innerHTML = '';
  if (!items.length) {
    workflowsEl.innerHTML = '<div class="wf-item">No workflows found.</div>';
    return;
  }

  items.forEach((item) => {
    const card = document.createElement('div');
    card.className = 'wf-item';
    card.innerHTML = `
      <div class="wf-name">${item.name || '(unnamed workflow)'}</div>
      <div class="wf-meta">id: ${item.id}</div>
      <div class="wf-meta">active: ${String(item.active)}</div>
      <div class="wf-meta">updatedAt: ${item.updatedAt || '-'}</div>
      <button data-id="${item.id}" style="margin-top:8px;">Run</button>
    `;

    const runBtn = card.querySelector('button');
    runBtn.addEventListener('click', () => {
      workflowIdInput.value = item.id;
      document.getElementById('runBtn').click();
    });

    workflowsEl.appendChild(card);
  });
}

document.getElementById('connectRelayBtn').addEventListener('click', connectRelay);
document.getElementById('refreshDevicesBtn').addEventListener('click', () => {
  if (relaySocket && relaySocket.readyState === WebSocket.OPEN) {
    relaySocket.send(
      JSON.stringify({
        type: 'register',
        role: 'dashboard',
        secret: relaySecretInput.value.trim(),
      })
    );
  } else {
    connectRelay();
  }
});

document.getElementById('statusBtn').addEventListener('click', async () => {
  statusOutput.textContent = 'Loading...';
  try {
    const result = await requestDevice('status');
    statusOutput.textContent = pretty(result);
  } catch (error) {
    statusOutput.textContent = error.message;
  }
});

document.getElementById('refreshBtn').addEventListener('click', async () => {
  workflowsEl.innerHTML = '<div class="wf-item">Loading...</div>';
  try {
    const result = await requestDevice('listWorkflows');
    renderWorkflows(result);
  } catch (error) {
    workflowsEl.innerHTML = `<div class="wf-item">${error.message}</div>`;
  }
});

document.getElementById('runBtn').addEventListener('click', async () => {
  runOutput.textContent = 'Running...';
  try {
    const workflowId = workflowIdInput.value.trim();
    if (!workflowId) throw new Error('workflowId is required');

    const payloadText = payloadInput.value.trim();
    const payload = payloadText ? JSON.parse(payloadText) : {};
    const wait = Boolean(waitInput.checked);
    const timeoutMs = Number(timeoutInput.value || 120000);

    const result = await requestDevice('runWorkflow', {
      workflowId,
      payload,
      wait,
      timeoutMs,
    });
    runOutput.textContent = pretty(result);
  } catch (error) {
    runOutput.textContent = error.message;
  }
});

document.getElementById('detectBtn').addEventListener('click', async () => {
  bridgeStatus.textContent = 'detecting...';
  try {
    const result = await requestLocal('status');
    bridgeStatus.textContent = 'ready';
    statusOutput.textContent = pretty(result);
    setSelectedDevice(result.deviceId || '');
  } catch (error) {
    bridgeStatus.textContent = 'not ready';
    statusOutput.textContent = error.message;
  }
});

loadRelayConfig();
if (relayUrlInput.value && relaySecretInput.value) {
  connectRelay();
}
