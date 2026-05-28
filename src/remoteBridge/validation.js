import {
  REMOTE_AUTOMA_ACTIONS,
  REMOTE_AUTOMA_REQUEST_SOURCE,
  REMOTE_AUTOMA_REQUEST_TYPE,
} from './constants';

const actionValues = Object.values(REMOTE_AUTOMA_ACTIONS);

export function validateBridgeRequest(data) {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Invalid request payload' };
  }

  if (data.source !== REMOTE_AUTOMA_REQUEST_SOURCE) {
    return { valid: false, error: 'Invalid request source' };
  }

  if (data.type !== REMOTE_AUTOMA_REQUEST_TYPE) {
    return { valid: false, error: 'Invalid request type' };
  }

  if (!data.requestId || typeof data.requestId !== 'string') {
    return { valid: false, error: 'requestId is required' };
  }

  if (!actionValues.includes(data.action)) {
    return { valid: false, error: 'Invalid action' };
  }

  return { valid: true };
}
