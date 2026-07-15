# Hefestos 🔨

> Servidor HTTP do [OpenCode](https://opencode.ai) — o coding agent open source, pronto para deploy no Render.

Hefestos é o deus grego da forja e da tecnologia. Este projeto expõe o `opencode web` como um web service, com interface web nativa para interagir com o agente via navegador, além da API REST para bots (Discord, Telegram, etc.).

## Stack

- **Node.js 22** (slim)
- **opencode-ai** (última versão)
- **Docker** (deploy no Render ou qualquer cloud)

## Comandos

### Local

```bash
# Iniciar o servidor com interface web
OPENCODE_SERVER_PASSWORD=sua-senha opencode web --port 4096
```

### Docker

```bash
docker build -t hefestos .
docker run -it --rm \
  -e OPENCODE_SERVER_PASSWORD=sua-senha \
  -e ANTHROPIC_API_KEY=sk-... \
  -p 4096:10000 \
  hefestos
```

## Web UI

Acesse `http://localhost:4096` no navegador para um chat completo com o agente.

## API

O servidor também expõe a mesma API REST com spec OpenAPI 3.1. Com o servidor rodando, acesse:

```
http://localhost:4096/doc
```

### Endpoints principais

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/global/health` | Health check |
| `GET` | `/session` | Listar sessões |
| `POST` | `/session` | Criar sessão |
| `POST` | `/session/:id/message` | Enviar mensagem |
| `GET` | `/config/providers` | Listar providers |
| `GET` | `/agent` | Listar agentes |

### Autenticação

Todas as requisições usam **HTTP Basic Auth**:

```
Username: opencode
Password: <OPENCODE_SERVER_PASSWORD>
```

Exemplo com curl:

```bash
curl -s http://opencode:suasenha@localhost:4096/global/health
```

## Deploy no Render

1. Crie um **Web Service** no [Render Dashboard](https://dashboard.render.com)
2. Conecte o repositório do GitHub
3. Adicione as env vars:

| Variável | Descrição |
|----------|-----------|
| `OPENCODE_SERVER_PASSWORD` | Senha para autenticação |
| `ANTHROPIC_API_KEY` | API key do Claude (opcional) |
| `OPENAI_API_KEY` | API key do GPT (opcional) |
| `GEMINI_API_KEY` | API key do Gemini (opcional) |

> O Render define a porta automaticamente via `$PORT` (o Dockerfile já usa `$PORT` com fallback para `10000`).

## Exemplo: Bot do Discord

Com o Hefestos rodando, seu bot pode chamar a API REST para interagir com o OpenCode:

```js
const response = await fetch('http://localhost:4096/session', {
  method: 'POST',
  headers: {
    'Authorization': 'Basic ' + btoa('opencode:' + password)
  }
})
const session = await response.json()

// Enviar prompt
await fetch(`http://localhost:4096/session/${session.id}/message`, {
  method: 'POST',
  headers: {
    'Authorization': 'Basic ' + btoa('opencode:' + password),
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    parts: [{ type: 'text', text: 'explique este código:' }]
  })
})
```

## Licença

MIT — construído sobre o [OpenCode](https://github.com/anomalyco/opencode) (MIT).
