# Server Portal - Raw Installation Guide

## 1. Requirements

Install Docker Engine and Docker Compose Plugin on the target server.

The project does not need Node.js, PostgreSQL, or Nginx installed directly on the host. They run inside Docker containers.

## 2. Configure environment

In the project directory:

```bash
cp .env.example .env
nano .env
```

Change these values for the target company/server:

```env
POSTGRES_PASSWORD=CHANGE_ME_DB_PASSWORD
INITIAL_ADMIN_PASSWORD=CHANGE_ME_ADMIN_PASSWORD
JWT_SECRET=CHANGE_ME_LONG_RANDOM_SECRET
```

Generate a strong JWT secret:

```bash
openssl rand -hex 64
```

Use the generated value for:

```env
JWT_SECRET=
```

## 3. Start the project

```bash
docker compose up -d --build
```

## 4. Check containers

```bash
docker ps
docker logs node_app --tail=100
```

Expected containers:

```text
postgres_db
node_app
nginx_web
```

## 5. Open the portal

Open in browser:

```text
http://SERVER-IP/
```

## 6. Login

Use the admin username and password configured in `.env`.

Default username is usually:

```text
admin
```

Password is the value of:

```env
INITIAL_ADMIN_PASSWORD
```

## 7. Database access with Navicat

Use these values:

```text
Host: SERVER-IP
Port: 5432
Database: value of POSTGRES_DB in .env
User: value of POSTGRES_USER in .env
Password: value of POSTGRES_PASSWORD in .env
```

## 8. Important notes

- Do not share `.env`.
- Do not put `.env` inside backups or public templates.
- Do not copy `backend/node_modules`.
- Do not copy database dumps or backup files.
- PostgreSQL data is stored in Docker volume.
- The project creates required database tables automatically on first run.
- Initial admin user is created when no admin user exists.
- Static frontend files are served by Nginx.
- Backend is accessed through Nginx `/api`.
- PostgreSQL port `5432` is published for Navicat access.
