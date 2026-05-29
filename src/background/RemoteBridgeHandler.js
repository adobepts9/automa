import {
  REMOTE_AUTOMA_ACTIONS,
  REMOTE_AUTOMA_RESPONSE_SOURCE,
  REMOTE_AUTOMA_RESPONSE_TYPE,
} from '@/remoteBridge/constants';
import {
  getRemoteControlSettings,
  isOriginAllowed,
} from '@/remoteBridge/settings';
import { validateBridgeRequest } from '@/remoteBridge/validation';
import RemoteBridgeWorkflowService from '@/remoteBridge/workflowService';

function getOriginFromSender(sender) {
  const candidateUrl = sender?.url || sender?.tab?.url || '';
  if (!candidateUrl) return '';

  try {
    return new URL(candidateUrl).origin;
  } catch (error) {
    return '';
  }
}

function buildResponse(requestId, response) {
  return {
    source: REMOTE_AUTOMA_RESPONSE_SOURCE,
    type: REMOTE_AUTOMA_RESPONSE_TYPE,
    requestId,
    response,
  };
}

class RemoteBridgeHandler {
  static async executeAction(message, remoteSettings) {
    let result = null;

    switch (message.action) {
      case REMOTE_AUTOMA_ACTIONS.STATUS:
        result = await RemoteBridgeWorkflowService.getStatus(remoteSettings);
        break;
      case REMOTE_AUTOMA_ACTIONS.LIST_WORKFLOWS:
        result = await RemoteBridgeWorkflowService.listWorkflows();
        break;
      case REMOTE_AUTOMA_ACTIONS.RUN_WORKFLOW:
        result = await RemoteBridgeWorkflowService.runWorkflow(
          message.payload || {}
        );
        break;
      default:
        throw new Error('invalid action');
    }

    return result;
  }

  static async handleRelayRequest(message) {
    const validation = validateBridgeRequest({
      ...message,
      source: 'remote-automa-dashboard',
      type: 'REMOTE_AUTOMA_REQUEST',
    });
    if (!validation.valid) {
      return buildResponse(message?.requestId || '', {
        ok: false,
        error: validation.error,
      });
    }

    const remoteSettings = await getRemoteControlSettings();
    if (!remoteSettings.enabled || !remoteSettings.cloudRelayEnabled) {
      return buildResponse(message.requestId, {
        ok: false,
        error: 'cloud relay not enabled',
      });
    }

    try {
      const result = await RemoteBridgeHandler.executeAction(
        message,
        remoteSettings
      );
      return buildResponse(message.requestId, { ok: true, result });
    } catch (error) {
      return buildResponse(message.requestId, {
        ok: false,
        error: error.message || 'unknown error',
      });
    }
  }

  static async handleRequest(message, sender) {
    const validation = validateBridgeRequest(message);
    if (!validation.valid) {
      return buildResponse(message?.requestId || '', {
        ok: false,
        error: validation.error,
      });
    }

    const remoteSettings = await getRemoteControlSettings();
    if (!remoteSettings.enabled || !remoteSettings.webBridgeEnabled) {
      return buildResponse(message.requestId, {
        ok: false,
        error: 'extension not ready',
      });
    }

    const pageOrigin = message?.origin || getOriginFromSender(sender);
    if (!isOriginAllowed(pageOrigin, remoteSettings.allowedDomains)) {
      return buildResponse(message.requestId, {
        ok: false,
        error: 'domain not allowed',
      });
    }

    try {
      const result = await RemoteBridgeHandler.executeAction(
        message,
        remoteSettings
      );
      return buildResponse(message.requestId, { ok: true, result });
    } catch (error) {
      return buildResponse(message.requestId, {
        ok: false,
        error: error.message || 'unknown error',
      });
    }
  }
}

export default RemoteBridgeHandler;
