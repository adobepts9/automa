<template>
  <div class="mb-12">
    <p class="mb-1 font-semibold">{{ t('settings.theme') }}</p>
    <div class="flex items-center space-x-4">
      <div
        v-for="item in theme.themes"
        :key="item.id"
        class="cursor-pointer"
        role="button"
        @click="theme.set(item.id)"
      >
        <div
          :class="{ 'ring ring-accent': item.id === theme.activeTheme.value }"
          class="rounded-lg p-0.5"
        >
          <img
            :src="require(`@/assets/images/theme-${item.id}.png`)"
            width="140"
            class="rounded-lg"
          />
        </div>
        <span class="ml-1 text-sm text-gray-600 dark:text-gray-200">
          {{ item.name }}
        </span>
      </div>
    </div>
  </div>
  <div class="flex items-center">
    <div id="languages">
      <p class="mb-1 font-semibold">{{ t('settings.language.label') }}</p>
      <ui-select
        :model-value="settings.locale"
        class="w-80"
        @change="updateLanguage"
      >
        <option
          v-for="locale in supportLocales"
          :key="locale.id"
          :value="locale.id"
        >
          {{ locale.name }}
        </option>
      </ui-select>
      <a
        class="ml-1 block text-gray-600 dark:text-gray-200"
        href="https://github.com/AutomaApp/automa/wiki/Help-Translate"
        target="_blank"
        rel="noopener"
      >
        {{ t('settings.language.helpTranslate') }}
      </a>
    </div>
    <p v-if="isLangChange" class="ml-4 inline-block">
      {{ t('settings.language.reloadPage') }}
    </p>
  </div>
  <div id="delete-logs" class="mt-12">
    <p class="mb-1 font-semibold">Workflow Logs</p>
    <div class="flex items-center">
      <ui-select
        :model-value="settings.deleteLogAfter"
        :label="t('settings.deleteLog.title')"
        placeholder="Delete after"
        class="w-80"
        @change="
          updateSetting(
            'deleteLogAfter',
            $event === 'never' ? 'never' : +$event
          )
        "
      >
        <option v-for="day in deleteLogDays" :key="day" :value="day">
          <template v-if="typeof day === 'string'">
            {{ t('settings.deleteLog.deleteAfter.never') }}
          </template>
          <template v-else>
            {{ t('settings.deleteLog.deleteAfter.days', { day }) }}
          </template>
        </option>
      </ui-select>
      <ui-input
        :model-value="settings.logsLimit"
        class="ml-4"
        type="number"
        label="Logs limit"
        min="10"
        @change="updateSetting('logsLimit', +$event <= 0 ? 1000 : +$event)"
      />
    </div>
  </div>
  <div id="remote-control" class="mt-12 max-w-2xl">
    <p class="mb-1 font-semibold">Remote Control</p>
    <p class="text-sm text-gray-600 dark:text-gray-200">
      Configure a domain-based bridge for remote dashboard control.
    </p>

    <ui-list class="mt-4 space-y-2">
      <ui-list-item small>
        <ui-switch v-model="remoteControl.enabled" />
        <div class="ml-4 flex-1">
          <p class="leading-tight">Remote Control</p>
          <p class="text-sm leading-tight text-gray-600 dark:text-gray-200">
            Master toggle for remote dashboard operations.
          </p>
        </div>
      </ui-list-item>
      <ui-list-item small>
        <ui-switch v-model="remoteControl.webBridgeEnabled" />
        <div class="ml-4 flex-1">
          <p class="leading-tight">Web Bridge</p>
          <p class="text-sm leading-tight text-gray-600 dark:text-gray-200">
            Allow web pages from approved domains to message the extension.
          </p>
        </div>
      </ui-list-item>
    </ui-list>

    <div class="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
      <ui-input
        v-model="remoteControl.deviceId"
        label="Device ID"
        placeholder="device-xxxx"
      />
      <ui-input
        v-model="remoteControl.deviceName"
        label="Device Name"
        placeholder="Office Chrome"
      />
    </div>

    <label class="mt-4 block text-sm font-medium">Allowed domains</label>
    <textarea
      v-model="allowedDomainsText"
      rows="5"
      class="mt-1 w-full rounded-lg border bg-transparent px-3 py-2 text-sm"
      placeholder="dashboard.example.com&#10;localhost"
    />
    <p class="mt-1 text-xs text-gray-600 dark:text-gray-200">
      One domain per line. No wildcard allowed.
    </p>

    <div class="mt-4 flex items-center gap-2">
      <ui-button @click="refreshRemoteStatus">Reconnect / Refresh</ui-button>
      <span class="text-sm text-gray-600 dark:text-gray-200">
        {{ remoteStatus }}
      </span>
    </div>
  </div>
</template>
<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useStore } from '@/stores/main';
import { useTheme } from '@/composable/theme';
import { nanoid } from 'nanoid';
import { supportLocales } from '@/utils/shared';

const deleteLogDays = ['never', 7, 14, 30, 60, 120];

const { t } = useI18n();
const store = useStore();
const theme = useTheme();

const isLangChange = ref(false);
const settings = computed(() => store.settings);
const remoteControl = ref({
  enabled: false,
  webBridgeEnabled: false,
  deviceId: '',
  deviceName: '',
  allowedDomains: [],
});
const allowedDomainsText = ref('');
const remoteStatus = ref('idle');

function updateSetting(path, value) {
  store.updateSettings({ [path]: value });
}
function updateLanguage(value) {
  isLangChange.value = true;

  updateSetting('locale', value);
}

function parseAllowedDomains(value) {
  return [...new Set(value.split('\n').map((item) => item.trim()).filter(Boolean))];
}

function ensureDeviceId() {
  if (remoteControl.value.deviceId) return;
  remoteControl.value.deviceId = `device-${nanoid(16)}`;
}

function syncRemoteSettings() {
  ensureDeviceId();
  store.updateSettings({
    remoteControl: {
      ...remoteControl.value,
      allowedDomains: parseAllowedDomains(allowedDomainsText.value),
    },
  });
}

function refreshRemoteStatus() {
  const mode = remoteControl.value.enabled
    ? remoteControl.value.webBridgeEnabled
      ? 'enabled'
      : 'bridge-off'
    : 'disabled';
  const domains = parseAllowedDomains(allowedDomainsText.value).length;
  remoteStatus.value = `${mode}, ${domains} domain(s), ${new Date().toLocaleTimeString()}`;
}

watch(
  remoteControl,
  () => {
    syncRemoteSettings();
  },
  { deep: true }
);

watch(allowedDomainsText, () => {
  syncRemoteSettings();
});

onMounted(() => {
  remoteControl.value = {
    enabled: Boolean(settings.value.remoteControl?.enabled),
    webBridgeEnabled: Boolean(settings.value.remoteControl?.webBridgeEnabled),
    deviceId: settings.value.remoteControl?.deviceId || '',
    deviceName: settings.value.remoteControl?.deviceName || '',
    allowedDomains: settings.value.remoteControl?.allowedDomains || [],
  };

  ensureDeviceId();
  allowedDomainsText.value = remoteControl.value.allowedDomains.join('\n');
  refreshRemoteStatus();
});
</script>
