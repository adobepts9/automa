# Cloud Relay (multi-device)

The cloud relay lets every machine with the extension appear on one web dashboard, from any browser or network.

## Architecture

```
Device A (extension) ──wss──┐
Device B (extension) ──wss──┼──► Relay server ◄──wss── Web dashboard (any browser)
Device C (extension) ──wss──┘
```

Local `postMessage` bridge still works only in the same browser tab.

## 1. Run the relay server

Copy the standalone folder `relay/` to your VPS (no need for the full extension repo). See `relay/README.md`.

```bash
cd relay
cp .env.example .env   # edit RELAY_SECRET
npm install
./start.sh
# or: RELAY_SECRET=your-strong-secret-here npm start
```

Default port: `8787`. Health check: `GET /health`.

Deploy this process on any host with a public URL (Railway, Fly.io, VPS). Put TLS in front (Caddy/nginx) so clients use `wss://`.

Example:

- Relay: `wss://relay.octostudio.site`
- Web dashboard: `https://rt.octostudio.site` (static on Vercel)

## 2. Configure each extension device

Settings → Remote Control:

1. **Remote Control** ON
2. **Cloud Relay** ON
3. **Relay URL**: `wss://relay.octostudio.site`
4. **Relay Secret**: same value as `RELAY_SECRET` on the server
5. Set **Device Name** (e.g. "Office Mac", "Home PC")
6. Click **Reconnect / Refresh**

Repeat on every machine. All online devices show on the dashboard.

## 3. Configure the web dashboard

1. Open the dashboard URL
2. Enter the same **Relay URL** and **Relay Secret**
3. Click **Connect Relay**
4. Click a device in the list
5. Use Get Status / Refresh Workflows / Run Workflow

Settings are stored in `localStorage` on that browser.

## Security

- Anyone with the relay URL + secret can list devices and run workflows.
- Use a long random `RELAY_SECRET`.
- Run relay behind HTTPS/WSS only.
- Do not commit secrets to git.

## Troubleshooting

| Symptom | Fix |
|--------|-----|
| No devices | Cloud Relay ON on device, correct URL/secret, relay server running |
| `unauthorized` | Secret mismatch between server, extension, and web |
| `device offline` | Extension closed, relay disconnected, or stale connection |
| Relay won't start on Vercel | Vercel static hosting cannot run WebSocket server — host `relay/` separately |
