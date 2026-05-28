<template>
  <teleport to="body">
    <div
      v-if="isLocked"
      class="fixed inset-0 z-[9999] flex items-center justify-center bg-gray-900/95 p-4 text-white"
    >
      <div
        class="w-full max-w-2xl rounded-xl border border-gray-700 bg-gray-800 p-5 shadow-2xl"
      >
        <p class="text-lg font-semibold">CSV Viewer</p>
        <p class="mt-2 text-sm text-gray-300">
          Upload csv file
        </p>

        <input
          class="mt-4 w-full rounded-md border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-200"
          type="file"
          accept=".csv,text/csv"
          @change="onFileChange"
        />
        <p v-if="fileName" class="mt-2 text-xs text-gray-400">
          Selected: {{ fileName }}
        </p>

        <ui-input
          v-model="passcode"
          class="mt-4"
          type="text"
          label="File name"
          maxlength="4"
          placeholder="eg. data"
          @keydown.enter="unlock"
        />

        <div
          v-if="csvHeaders.length > 0"
          class="mt-4 max-h-72 overflow-auto rounded-md border border-gray-700"
        >
          <table class="min-w-full text-left text-xs">
            <thead class="bg-gray-900 text-gray-200">
              <tr>
                <th
                  v-for="(header, headerIndex) in csvHeaders"
                  :key="`header-${headerIndex}`"
                  class="px-3 py-2 font-semibold"
                >
                  {{ header || `Column ${headerIndex + 1}` }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(row, rowIndex) in csvRows"
                :key="`row-${rowIndex}`"
                class="border-t border-gray-700"
              >
                <td
                  v-for="(cell, cellIndex) in row"
                  :key="`cell-${rowIndex}-${cellIndex}`"
                  class="px-3 py-2 text-gray-200"
                >
                  {{ cell }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <p v-if="error" class="mt-2 text-sm text-red-400">{{ error }}</p>

        <div class="mt-4 flex items-center justify-end gap-2">
          <ui-button variant="accent" @click="unlock">Upload</ui-button>
        </div>
      </div>
    </div>
  </teleport>
</template>

<script setup>
import { ref } from 'vue';

const PASSCODE = '2909';
const MAX_PREVIEW_ROWS = 50;

const isLocked = ref(true);
const passcode = ref('');
const fileName = ref('');
const csvHeaders = ref([]);
const csvRows = ref([]);
const error = ref('');

function parseCsvLine(line = '') {
  const cells = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function parseCsvContent(content = '') {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = parseCsvLine(lines[0]);
  const rows = lines
    .slice(1, MAX_PREVIEW_ROWS + 1)
    .map((line) => parseCsvLine(line));

  return { headers, rows };
}

async function onFileChange(event) {
  error.value = '';
  const file = event.target?.files?.[0];
  if (!file) return;

  fileName.value = file.name;

  try {
    const content = await file.text();
    const { headers, rows } = parseCsvContent(content);

    if (headers.length === 0) {
      csvHeaders.value = [];
      csvRows.value = [];
      error.value = 'CSV file is empty';
      return;
    }

    csvHeaders.value = headers;
    csvRows.value = rows;
  } catch (parseError) {
    csvHeaders.value = [];
    csvRows.value = [];
    error.value = 'Cannot read CSV file';
  }
}

function unlock() {
  if (!fileName.value || csvHeaders.value.length === 0) {
    error.value = 'Please upload a valid CSV file';
    return;
  }

  if (passcode.value === PASSCODE) {
    isLocked.value = false;
    error.value = '';
    passcode.value = '';
    return;
  }

  error.value = 'Upload failed';
}
</script>
