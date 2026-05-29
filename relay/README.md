# Automa Cloud Relay (standalone)

WebSocket hub để **nhiều máy cài extension** hiện trên **một web dashboard** (bất kỳ trình duyệt / mạng nào).

**Chỉ cần copy folder này** lên VPS — không cần cả repo extension.

## Files trong folder

```
relay/
├── server.mjs          # Relay server
├── package.json
├── .env.example        # Mẫu cấu hình
├── start.sh            # Chạy nhanh (Linux/macOS)
├── Dockerfile
├── docker-compose.yml
└── README.md
```

## 1. Cài trên VPS (Node)

```bash
# Copy folder relay lên VPS (scp, zip, git...)
cd relay
cp .env.example .env
nano .env   # đặt RELAY_SECRET mạnh

npm install
chmod +x start.sh
./start.sh
```

Hoặc một dòng:

```bash
RELAY_SECRET=your-secret PORT=8787 npm start
```

Kiểm tra:

```bash
curl http://YOUR_VPS_IP:8787/health
```

## 2. Docker

```bash
cp .env.example .env
# sửa RELAY_SECRET trong .env

docker compose up -d --build
```

## 3. HTTPS / WSS (production)

Extension và web dùng **`wss://`**, không `ws://` trên internet.

Ví dụ `relay.example.com` → proxy tới `localhost:8787`.

**Caddy:**

```text
relay.example.com {
  reverse_proxy localhost:8787
}
```

URL dùng trong extension + web:

```text
wss://relay.example.com
```

## 4. Extension (mỗi máy)

Settings → Remote Control:

| Field | Value |
|-------|--------|
| Remote Control | ON |
| Cloud Relay | ON |
| Relay URL | `wss://relay.example.com` |
| Relay Secret | giống `RELAY_SECRET` trên server |
| Device Name | vd. Office PC, Laptop 2 |

## 5. Web dashboard

- Relay URL + Relay Secret (cùng server)
- **Connect Relay** → chọn device → Get Status / Run workflow

## Bảo mật

- `RELAY_SECRET` dài, ngẫu nhiên.
- Không commit `.env`.
- Chỉ expose qua HTTPS/WSS.

## PM2 (tùy chọn)

```bash
RELAY_SECRET=xxx PORT=8787 pm2 start server.mjs --name automa-relay
pm2 save
```

## Troubleshooting

| Vấn đề | Gợi ý |
|--------|--------|
| `unauthorized` | Secret khác nhau giữa server / extension / web |
| Không thấy device | Cloud Relay ON, extension chạy, mở port VPS |
| Web không kết nối | Dùng `wss://` + SSL hợp lệ |
| PC nhà không mở port | Chạy relay trên **VPS**; PC chỉ kết nối ra |

## Copy folder (không cần node_modules)

```bash
# Trên máy dev — zip để đưa lên VPS
cd /path/to/parent
zip -r automa-relay.zip relay -x "relay/node_modules/*"
```

Trên VPS: `unzip automa-relay.zip && cd relay && cp .env.example .env && ./start.sh`
