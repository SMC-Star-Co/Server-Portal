FROM node:24-alpine
RUN apk add --no-cache zip ffmpeg imagemagick imagemagick-heic imagemagick-jpeg imagemagick-webp libheif
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
