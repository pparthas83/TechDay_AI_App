FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

ENV PORT=8080
ENV NODE_ENV=production
ENV GOOGLE_CLOUD_PROJECT=pradeep-demo-1
ENV GOOGLE_CLOUD_REGION=us-central1
ENV GEMINI_MODEL=gemini-3.6-flash

EXPOSE 8080

CMD ["node", "server.js"]
