FROM node:24-alpine
RUN apk add --no-cache zip ffmpeg imagemagick imagemagick-heic imagemagick-jpeg imagemagick-webp libheif poppler-utils fontconfig font-dejavu
RUN npm install --prefix /opt/portal-pdf --omit=optional --ignore-scripts --no-audit --no-fund pdfjs-dist@6.5.438 jspdf@4.2.1
# Build the local PDF exporter asset with the installed Persian-capable font.
RUN node -e 'const fs=require("node:fs");const font=process.argv[1];if(!font)throw Error("Missing Persian font");fs.writeFileSync("/opt/portal-pdf/serial-report-assets-v1.js",fs.readFileSync("/opt/portal-pdf/node_modules/jspdf/dist/jspdf.umd.min.js","utf8")+"\n;globalThis.SerialReportFontBase64="+JSON.stringify(fs.readFileSync(font).toString("base64"))+";\n")' "$(fc-match -f '%{file}' 'DejaVu Sans:style=Book')"
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
