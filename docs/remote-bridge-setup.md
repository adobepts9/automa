# Remote Bridge Setup

This fork includes a domain-based remote bridge that allows a web dashboard to:

- detect the extension
- list local workflows
- trigger local workflow runs

## 1) Configure extension settings

1. Open Automa dashboard.
2. Go to `Settings` -> `General` -> `Remote Control`.
3. Configure:
   - `Remote Control`: ON
   - `Web Bridge`: ON
   - `Device ID`: auto-generated (edit if needed)
   - `Device Name`: optional
   - `Allowed domains`: one domain per line (example: `localhost`, `dashboard.example.com`)
4. Click `Reconnect / Refresh`.

Important:
- Keep allowlist strict.
- Wildcards are rejected.
- Empty allowlist means no remote access.

## 2) Local dashboard test (static page)

Use a local page on an allowed origin (for example `http://localhost:5500`):

```html
<!doctype html>
<html>
  <body>
    <pre id="out"></pre>
    <script>
      const out = document.getElementById('out');
      const source = 'remote-automa-dashboard';

      window.addEventListener('message', (event) => {
        if (event.data?.source !== 'remote-automa-extension') return;
        out.textContent += `${JSON.stringify(event.data, null, 2)}\n\n`;
      });

      function send(action, payload = {}) {
        window.postMessage(
          {
            source,
            type: 'REMOTE_AUTOMA_REQUEST',
            requestId: crypto.randomUUID(),
            action,
            payload,
          },
          window.location.origin
        );
      }

      // Call after REMOTE_AUTOMA_READY appears
      setTimeout(() => {
        send('status');
        send('listWorkflows');
      }, 1200);
    </script>
  </body>
</html>
```

## 3) Troubleshooting

- `extension not ready`
  - Enable `Remote Control` and `Web Bridge`.
- `domain not allowed`
  - Add page hostname to allowlist and refresh page.
- no `REMOTE_AUTOMA_READY` event
  - Verify page origin is in allowlist and reload tab.
- `workflow not found`
  - Check workflow id from `listWorkflows` response.
- `workflow timeout`
  - Increase `timeoutMs` in `runWorkflow` payload.
