FROM node:22-slim

RUN apt-get update && apt-get install -y git curl ca-certificates && rm -rf /var/lib/apt/lists/*

RUN npm install -g opencode-ai@latest

EXPOSE 10000

CMD ["sh", "-c", "opencode serve --hostname 0.0.0.0 --port ${PORT:-10000}"]
