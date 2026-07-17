FROM node:22-slim

RUN apt-get update && apt-get install -y git curl ca-certificates xdg-utils && rm -rf /var/lib/apt/lists/*

RUN npm install -g opencode-ai@latest

WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .

EXPOSE 10000

ENTRYPOINT ["./entrypoint.sh"]
