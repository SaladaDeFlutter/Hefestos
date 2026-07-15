FROM node:22-slim

RUN apt-get update && apt-get install -y git curl ca-certificates && rm -rf /var/lib/apt/lists/*

RUN npm install -g opencode-ai@latest

WORKDIR /app
COPY opencode.json .

EXPOSE 10000

CMD ["sh", "-c", "opencode web --hostname 0.0.0.0 --port ${PORT:-10000}"]
