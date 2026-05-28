const REQUEST_SOURCE = 'remote-automa-dashboard';
const REQUEST_TYPE = 'REMOTE_AUTOMA_REQUEST';
const RESPONSE_SOURCE = 'remote-automa-extension';
const RESPONSE_TYPE = 'REMOTE_AUTOMA_RESPONSE';
const READY_TYPE = 'REMOTE_AUTOMA_READY';

const bridgeStatus = document.getElementById('bridgeStatus');
const statusOutput = document.getElementById('statusOutput');
const runOutput = document.getElementById('runOutput');
const workflowsEl = document.getElementById('workflows');

const workflowIdInput = document.getElementById('workflowIdInput');
const payloadInput = document.getElementById('payloadInput');
const waitInput = document.getElementById('waitInput');
const timeoutInput = document.getElementById('timeoutInput');

const pendingRequests = new Map();
const REQUEST_TIMEOUT_MS = 15000;

function setBridgeStatus(text) {
  bridgeStatus.textContent = text;
}

function pretty(value) {
  return JSON.stringify(value, null, 2);
}

function requestBridge(action, payload = {}) {
  const requestId = crypto.randomUUID();

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingRequests.delete(requestId);
      reject(new Error('Request timeout'));
    }, REQUEST_TIMEOUT_MS);

    pendingRequests.set(requestId, { resolve, reject, timeout });

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

window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  const data = event.data;
  if (!data || data.source !== RESPONSE_SOURCE) return;

  if (data.type === READY_TYPE) {
    setBridgeStatus('ready');
    return;
  }

  if (data.type !== RESPONSE_TYPE || !data.requestId) return;

  const req = pendingRequests.get(data.requestId);
  if (!req) return;

  clearTimeout(req.timeout);
  pendingRequests.delete(data.requestId);

  if (data.response?.ok) req.resolve(data.response.result);
  else req.reject(new Error(data.response?.error || 'Unknown error'));
});

document.getElementById('detectBtn').addEventListener('click', async () => {
  setBridgeStatus('detecting...');
  try {
    const result = await requestBridge('status');
    setBridgeStatus('ready');
    statusOutput.textContent = pretty(result);
  } catch (error) {
    setBridgeStatus('not ready');
    statusOutput.textContent = error.message;
  }
});

document.getElementById('statusBtn').addEventListener('click', async () => {
  statusOutput.textContent = 'Loading...';
  try {
    const result = await requestBridge('status');
    statusOutput.textContent = pretty(result);
  } catch (error) {
    statusOutput.textContent = error.message;
  }
});

document.getElementById('refreshBtn').addEventListener('click', async () => {
  workflowsEl.innerHTML = '<div class="wf-item">Loading...</div>';
  try {
    const result = await requestBridge('listWorkflows');
    renderWorkflows(result);
  } catch (error) {
    workflowsEl.innerHTML = `<div class="wf-item">${error.message}</div>`;
  }
});

document.getElementById('runBtn').addEventListener('click', async () => {
  runOutput.textContent = 'Running...';
  try {
    const workflowId = workflowIdInput.value.trim();
    if (!workflowId) {
      throw new Error('workflowId is required');
    }

    const payloadText = payloadInput.value.trim();
    const payload = payloadText ? JSON.parse(payloadText) : {};
    const wait = Boolean(waitInput.checked);
    const timeoutMs = Number(timeoutInput.value || 120000);

    const result = await requestBridge('runWorkflow', {
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
