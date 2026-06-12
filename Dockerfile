FROM node:20-alpine

WORKDIR /app

COPY skeleton/package*.json ./
RUN if [ -s package.json ]; then npm ci --omit=dev || npm install --omit=dev; fi

COPY skeleton/ ./

ENV NODE_ENV=production
ENV PORT=4000

EXPOSE 4000

CMD ["node", "server.js"]
