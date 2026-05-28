import {
  REMOTE_AUTOMA_READY_TYPE,
  REMOTE_AUTOMA_REQUEST_SOURCE,
  REMOTE_AUTOMA_REQUEST_TYPE,
  REMOTE_AUTOMA_RESPONSE_SOURCE,
} from '@/remoteBridge/constants';
import {
  getRemoteControlSettings,
  isOriginAllowed,
} from '@/remoteBridge/settings';
import { validateBridgeRequest } from '@/remoteBridge/validation';
import { sendMessage } from '@/utils/message';

const LOCAL_REQUEST_TIMEOUT = 10000;

function postErrorResponse(requestId, error) {
  window.postMessage(
    {
      source: REMOTE_AUTOMA_RESPONSE_SOURCE,
      type: 'REMOTE_AUTOMA_RESPONSE',
      requestId,
      response: {
        ok: false,
        error,
      },
    },
    window.location.origin
  );
}

async function sendBridgeRequestToBackground(data, retries = 1) {
  try {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('bridge timeout')), LOCAL_REQUEST_TIMEOUT);
    });

    return await Promise.race([
      sendMessage('remote-bridge:request', data, 'background'),
      timeoutPromise,
    ]);
  } catch (error) {
    if (retries <= 0) throw error;
    return sendBridgeRequestToBackground(data, retries - 1);
  }
}

export async function initRemoteBridge() {
  window.addEventListener('message', async (event) => {
    if (event.source !== window) return;

    const data = event.data;
    if (
      !data ||
      data.source !== REMOTE_AUTOMA_REQUEST_SOURCE ||
      data.type !== REMOTE_AUTOMA_REQUEST_TYPE
    ) {
      return;
    }

    const validation = validateBridgeRequest(data);
    if (!validation.valid) {
      postErrorResponse(data?.requestId || '', validation.error);
      return;
    }

    try {
      const response = await sendBridgeRequestToBackground({
        ...data,
        origin: window.location.origin,
      });
      window.postMessage(response, window.location.origin);
    } catch (error) {
      postErrorResponse(data.requestId, error.message || 'bridge failed');
    }
  });

  const remoteSettings = await getRemoteControlSettings();
  const enabled = remoteSettings.enabled && remoteSettings.webBridgeEnabled;
  const allowed = isOriginAllowed(window.location.origin, remoteSettings.allowedDomains);
  if (!enabled || !allowed) return;

  window.postMessage(
    {
      source: REMOTE_AUTOMA_RESPONSE_SOURCE,
      type: REMOTE_AUTOMA_READY_TYPE,
    },
    window.location.origin
  );
}
