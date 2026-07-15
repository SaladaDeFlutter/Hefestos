FROM node:22-slim

RUN apt-get update && apt-get install -y git curl ca-certificates && rm -rf /var/lib/apt/lists/*

RUN npm install -g opencode-ai@latest

WORKDIR /app
COPY opencode.json index.html proxy.js start-docker.sh ./
RUN chmod +x start-docker.sh

EXPOSE 10000

CMD ["./start-docker.sh"]
