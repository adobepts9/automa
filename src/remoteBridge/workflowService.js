import dbLogs from '@/db/logs';
import BackgroundWorkflowUtils from '@/background/BackgroundWorkflowUtils';
import browser from 'webextension-polyfill';

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function formatWorkflowMetadata(workflow) {
  return {
    id: workflow.id,
    name: workflow.name,
    active: !workflow.isDisabled,
    updatedAt: workflow.updatedAt || workflow.createdAt || null,
  };
}

async function getWorkflowStatesByWorkflow(workflowId) {
  const { workflowStates = [] } = await browser.storage.local.get('workflowStates');
  return workflowStates.filter((item) => item.workflowId === workflowId);
}

async function waitForNewExecutionState(workflowId, previousStateIds, timeoutMs) {
  const startedAt = Date.now();
  let stateId = null;

  while (!stateId) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error('workflow timeout');
    }

    const states = await getWorkflowStatesByWorkflow(workflowId);
    const found = states.find((state) => !previousStateIds.has(state.id));
    if (found) {
      stateId = found.id;
      break;
    }

    await sleep(250);
  }

  return stateId;
}

async function waitForExecutionFinish(stateId, timeoutMs) {
  const startedAt = Date.now();

  while (true) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error('workflow timeout');
    }

    const { workflowStates = [] } = await browser.storage.local.get('workflowStates');
    const running = workflowStates.some((state) => state.id === stateId);
    if (!running) return;

    await sleep(300);
  }
}

async function getLatestWorkflowRun(workflowId, minStartedAt) {
  const items = await dbLogs.items
    .where('workflowId')
    .equals(workflowId)
    .filter((item) => item.startedAt >= minStartedAt)
    .toArray();

  if (items.length === 0) return null;

  items.sort((a, b) => b.startedAt - a.startedAt);
  return items[0];
}

class RemoteBridgeWorkflowService {
  static async getStatus(remoteControlSettings) {
    const manifest = browser.runtime.getManifest();
    return {
      extensionVersion: manifest.version,
      browserInfo: {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
      },
      platformInfo: await browser.runtime.getPlatformInfo(),
      deviceId: remoteControlSettings.deviceId,
      deviceName: remoteControlSettings.deviceName || '',
    };
  }

  static async listWorkflows() {
    const { workflows } = await browser.storage.local.get('workflows');
    const normalized = Array.isArray(workflows)
      ? workflows
      : Object.values(workflows || {});

    return normalized.map(formatWorkflowMetadata);
  }

  static async runWorkflow(payload = {}) {
    const workflowId = payload.workflowId;
    const wait = Boolean(payload.wait);
    const timeoutMs = Math.min(Math.max(payload.timeoutMs || 120000, 3000), 600000);

    if (!workflowId || typeof workflowId !== 'string') {
      throw new Error('workflowId is required');
    }

    const workflow = await BackgroundWorkflowUtils.getWorkflow(workflowId);
    if (!workflow) throw new Error('workflow not found');
    if (workflow.isDisabled) throw new Error('workflow is inactive');

    const previousStates = await getWorkflowStatesByWorkflow(workflowId);
    const previousStateIds = new Set(previousStates.map((item) => item.id));
    const startedAt = Date.now();

    await BackgroundWorkflowUtils.instance.executeWorkflow(workflow, {
      ...(payload.payload ? { data: payload.payload } : {}),
    });

    if (!wait) {
      return {
        status: 'accepted',
        workflowId,
      };
    }

    const stateId = await waitForNewExecutionState(
      workflowId,
      previousStateIds,
      timeoutMs
    );

    await waitForExecutionFinish(stateId, timeoutMs);
    const latestRun = await getLatestWorkflowRun(workflowId, startedAt);

    if (!latestRun) {
      return {
        status: 'running',
        workflowId,
        stateId,
      };
    }

    if (latestRun.status === 'success') {
      return {
        status: 'success',
        workflowId,
        stateId,
        result: {
          startedAt: latestRun.startedAt,
          endedAt: latestRun.endedAt,
        },
      };
    }

    return {
      status: 'error',
      workflowId,
      stateId,
      error: latestRun.message || 'workflow execution failed',
    };
  }
}

export default RemoteBridgeWorkflowService;
