FROM node:24-alpine
RUN apk add --no-cache zip ffmpeg imagemagick imagemagick-heic imagemagick-jpeg imagemagick-webp libheif poppler-utils fontconfig font-dejavu
RUN npm install --prefix /opt/portal-pdf --omit=optional --ignore-scripts --no-audit --no-fund pdfjs-dist@6.5.438
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
