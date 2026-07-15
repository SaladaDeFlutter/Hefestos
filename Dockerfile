FROM node:22-slim

RUN apt-get update && apt-get install -y git curl ca-certificates && rm -rf /var/lib/apt/lists/*

RUN npm install -g opencode-ai@latest

WORKDIR /app
COPY opencode.json index.html proxy.js ./

EXPOSE 10000

CMD ["sh", "-c", "opencode serve --hostname 0.0.0.0 --port 10001 & sleep 2 && exec node proxy.js"]
