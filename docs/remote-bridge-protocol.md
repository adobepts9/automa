# Remote Bridge Protocol

## Page -> Extension request

```json
{
  "source": "remote-automa-dashboard",
  "type": "REMOTE_AUTOMA_REQUEST",
  "requestId": "string",
  "action": "status | listWorkflows | runWorkflow",
  "payload": {}
}
```

Rules:
- `source` and `type` must match exactly.
- `requestId` is required.
- `action` must be one of: `status`, `listWorkflows`, `runWorkflow`.

## Extension -> Page response

```json
{
  "source": "remote-automa-extension",
  "type": "REMOTE_AUTOMA_RESPONSE",
  "requestId": "string",
  "response": {
    "ok": true,
    "result": {}
  }
}
```

Error response:

```json
{
  "source": "remote-automa-extension",
  "type": "REMOTE_AUTOMA_RESPONSE",
  "requestId": "string",
  "response": {
    "ok": false,
    "error": "error message"
  }
}
```

## Extension ready event

```json
{
  "source": "remote-automa-extension",
  "type": "REMOTE_AUTOMA_READY"
}
```

## Actions

### `status`
Returns:
- extension version
- browser/platform info
- device id and optional device name

### `listWorkflows`
Returns local workflow metadata:
- `id`
- `name`
- `active`
- `updatedAt`

### `runWorkflow`
Payload:

```json
{
  "workflowId": "string",
  "payload": {},
  "wait": true,
  "timeoutMs": 120000
}
```

Response result status values:
- `accepted` (run accepted, no wait)
- `running` (run started but final log unavailable)
- `success`
- `error`
