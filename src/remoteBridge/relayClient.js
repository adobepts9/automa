import browser from 'webextension-polyfill';
import RemoteBridgeHandler from '@/background/RemoteBridgeHandler';
import { getRemoteControlSettings } from '@/remoteBridge/settings';
import RemoteBridgeWorkflowService from '@/remoteBridge/workflowService';

const RECONNECT_MS = 5000;
const PING_MS = 25000;

function normalizeRelayUrl(url = '') {
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('ws://') || trimmed.startsWith('wss://')) return trimmed;
  if (trimmed.startsWith('http://')) return trimmed.replace('http://', 'ws://');
  if (trimmed.startsWith('https://')) return trimmed.replace('https://', 'wss://');
  return `wss://${trimmed}`;
}

class RemoteRelayClient {
  constructor() {
    this.socket = null;
    this.shouldRun = false;
    this.reconnectTimer = null;
    this.pingTimer = null;
    this.connecting = false;
  }

  async start() {
    this.shouldRun = true;
    await this.connect();
  }

  disconnectSocket() {
    clearTimeout(this.reconnectTimer);
    clearInterval(this.pingTimer);
    this.reconnectTimer = null;
    this.pingTimer = null;

    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  stop() {
    this.shouldRun = false;
    this.disconnectSocket();
  }

  scheduleReconnect() {
    if (!this.shouldRun || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, RECONNECT_MS);
  }

  async connect() {
    if (!this.shouldRun || this.connecting) return;

    const settings = await getRemoteControlSettings();
    if (
      !settings.enabled ||
      !settings.cloudRelayEnabled ||
      !settings.relayUrl ||
      !settings.relaySecret
    ) {
      this.disconnectSocket();
      this.connecting = false;
      return;
    }

    const relayUrl = normalizeRelayUrl(settings.relayUrl);
    if (!relayUrl) return;

    this.connecting = true;

    try {
      if (this.socket) {
        this.socket.close();
        this.socket = null;
      }

      const socket = new WebSocket(relayUrl);
      this.socket = socket;

      socket.addEventListener('open', async () => {
        this.connecting = false;
        const status = await RemoteBridgeWorkflowService.getStatus(settings);
        socket.send(
          JSON.stringify({
            type: 'register',
            role: 'device',
            secret: settings.relaySecret,
            deviceId: settings.deviceId,
            deviceName: settings.deviceName || '',
            meta: {
              extensionVersion: status.extensionVersion,
              platform: status.platformInfo?.os,
            },
          })
        );

        clearInterval(this.pingTimer);
        this.pingTimer = setInterval(() => {
          if (socket.readyState !== WebSocket.OPEN) return;
          socket.send(JSON.stringify({ type: 'ping' }));
        }, PING_MS);
      });

      socket.addEventListener('message', async (event) => {
        let data;
        try {
          data = JSON.parse(event.data);
        } catch {
          return;
        }

        if (data.type !== 'request' || !data.requestId) return;

        const response = await RemoteBridgeHandler.handleRelayRequest({
          requestId: data.requestId,
          action: data.action,
          payload: data.payload || {},
        });

        if (socket.readyState === WebSocket.OPEN) {
          socket.send(
            JSON.stringify({
              type: 'response',
              requestId: data.requestId,
              response: response.response,
            })
          );
        }
      });

      socket.addEventListener('close', () => {
        this.connecting = false;
        clearInterval(this.pingTimer);
        this.pingTimer = null;
        if (this.shouldRun) this.scheduleReconnect();
      });

      socket.addEventListener('error', () => {
        this.connecting = false;
      });
    } catch (error) {
      this.connecting = false;
      console.error('cloud relay connect failed', error);
      this.scheduleReconnect();
    }
  }
}

const remoteRelayClient = new RemoteRelayClient();

export async function syncCloudRelayConnection() {
  const settings = await getRemoteControlSettings();
  const shouldConnect =
    settings.enabled &&
    settings.cloudRelayEnabled &&
    Boolean(settings.relayUrl && settings.relaySecret);

  if (shouldConnect) {
    remoteRelayClient.shouldRun = true;
    await remoteRelayClient.start();
    return;
  }

  remoteRelayClient.stop();
}

export function initCloudRelayListener() {
  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.settings) return;
    syncCloudRelayConnection().catch((error) => {
      console.error('cloud relay sync failed', error);
    });
  });

  syncCloudRelayConnection().catch((error) => {
    console.error('cloud relay init failed', error);
  });
}
