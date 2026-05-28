# Remote Dashboard (Web)

Static web dashboard that talks to the extension bridge using `postMessage`.

Features:
- detect extension
- fetch extension status
- list local workflows
- trigger workflow runs

## Local test

Serve this folder with any static server and open in browser:

```bash
cd web
python3 -m http.server 5500
```

Open `http://localhost:5500`.

## Vercel deploy

1. Push repository to GitHub.
2. In Vercel, import this repository.
3. Set **Root Directory** to `web`.
4. Framework preset: `Other`.
5. Build command: leave empty.
6. Output directory: leave empty.
7. Deploy.

After deploy:
- Add custom domain `rt.octostudio.site` in Vercel project settings.
- Add `rt.octostudio.site` into extension allowlist.
- In extension settings, enable:
  - Remote Control
  - Web Bridge

