import { nanoid } from 'nanoid';
import browser from 'webextension-polyfill';

const STORAGE_KEY = 'settings';

const defaultSettings = () => ({
  remoteControl: {
    enabled: false,
    webBridgeEnabled: false,
    cloudRelayEnabled: false,
    relayUrl: '',
    relaySecret: '',
    deviceId: `device-${nanoid(16)}`,
    deviceName: '',
    allowedDomains: [],
  },
});

function normalizeDomain(domain = '') {
  return domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
}

export function normalizeAllowedDomains(domains = []) {
  if (!Array.isArray(domains)) return [];

  return [...new Set(domains.map(normalizeDomain).filter(Boolean))];
}

export async function getRemoteControlSettings() {
  const { settings } = await browser.storage.local.get(STORAGE_KEY);
  const mergedSettings = {
    ...defaultSettings(),
    ...(settings || {}),
    remoteControl: {
      ...defaultSettings().remoteControl,
      ...(settings?.remoteControl || {}),
    },
  };

  mergedSettings.remoteControl.allowedDomains = normalizeAllowedDomains(
    mergedSettings.remoteControl.allowedDomains
  );

  if (!mergedSettings.remoteControl.deviceId) {
    mergedSettings.remoteControl.deviceId = `device-${nanoid(16)}`;
    await browser.storage.local.set({ settings: mergedSettings });
  }

  return mergedSettings.remoteControl;
}

export function isOriginAllowed(origin = '', allowedDomains = []) {
  if (!origin || !Array.isArray(allowedDomains) || allowedDomains.length === 0) {
    return false;
  }

  let hostname = '';
  try {
    hostname = new URL(origin).hostname.toLowerCase();
  } catch (error) {
    return false;
  }

  return allowedDomains.some((domain) => {
    if (!domain) return false;
    if (domain.includes('*')) return false;

    if (domain.startsWith('.')) {
      const normalized = domain.slice(1);
      return hostname === normalized || hostname.endsWith(`.${normalized}`);
    }

    return hostname === domain;
  });
}
