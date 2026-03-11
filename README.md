# GITdeadline

**Seu Código é seu Tempo** — Plataforma de gamificação para desenvolvedores inspirada em *O Preço do Amanhã*.

O tempo é a moeda. O ranking é a longevidade digital.

## Stack

- **Backend:** Go (engine de tempo, webhooks GitHub, WebSockets)
- **Banco:** Redis (ranking em tempo real)
- **Frontend:** Svelte 5 + Tailwind CSS (dark mode, tipografia mono)

## Mecânicas

| Ação | Recompensa |
|------|------------|
| PR Merged | +72h |
| Issue resolvida | +48h |
| Commit | +1h (cooldown 1h anti-spam) |

O relógio decrementa **1 segundo por segundo real**. Verde → Amarelo → Vermelho conforme a proximidade da Morte Digital (0h).

## Como rodar

### 1. Redis

```bash
docker run -d -p 6379:6379 redis:alpine
```

Ou com Docker Compose:
```bash
docker-compose up -d redis
```

### 2. Backend

```bash
cd backend
go mod download
go run .
```

API em `http://localhost:8080`

### 3. Frontend (dev)

```bash
cd frontend
npm install
npm run dev
```

Acesse `http://localhost:5173` (o Vite faz proxy para a API).

### Build para produção

```bash
cd frontend && npm run build
cd ../backend && go build -o gitdeadline .
cd .. && STATIC_DIR=frontend/build ./backend/gitdeadline   # Linux/Mac
# ou no Windows: set STATIC_DIR=frontend\build && backend\gitdeadline.exe
```

O backend serve os arquivos estáticos. Use `STATIC_DIR` para indicar o caminho.

## Webhook GitHub

Configure em **Settings → Webhooks** do repositório:

- URL: `https://seu-dominio.com/api/webhook/github`
- Content type: `application/json`
- Events: `Pull requests`, `Issues`, `Pushes`
- Secret: definida em `GITHUB_WEBHOOK_SECRET` (opcional)

## Variáveis de ambiente

| Variável | Padrão |
|----------|--------|
| `REDIS_ADDR` | `localhost:6379` |
| `PORT` | `8080` |
| `GITHUB_WEBHOOK_SECRET` | (vazio) |

## API

- `GET /api/time/{user}` — tempo restante em segundos
- `GET /api/ranking` — top 50 por longevidade
- `POST /api/user/{user}/init` — inicializa usuário (24h)
- `GET /api/ws?user=X` — WebSocket para updates em tempo real
