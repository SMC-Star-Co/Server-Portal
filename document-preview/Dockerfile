FROM node:24-alpine
RUN apk add --no-cache libreoffice-writer libreoffice-calc libreoffice-impress fontconfig font-dejavu
WORKDIR /app
COPY server.js .
USER 65534:65534
ENV HOME=/tmp
EXPOSE 3001
CMD ["node","server.js"]
