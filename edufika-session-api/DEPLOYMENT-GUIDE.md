# Edufika Session API - VPS Deployment Guide

## Overview
This guide covers deploying the Edufika Session API to your VPS using Docker.

**Your VPS Details:**
- Hostname: `edufika.techivibes.com`
- Database: MariaDB (user: edufika, password: edufika, database: edufika)

---

## Step 1: Transfer Files to VPS

Upload the `edufika-session-api` folder to your VPS. You can use SCP, SFTP, or Git:

```
bash
# Option A: Using Git (recommended)
# Push to your Git repository, then clone on VPS:
git clone <your-repo-url> edufika-session-api
cd edufika-session-api

# Option B: Using SCP
scp -r ./edufika-session-api user@edufika.techivibes.com:/home/user/
```

---

## Step 2: Configure Environment Variables

The `.env` file has already been configured with production settings. Update it with your secrets.

**Required .env configuration:**

```
HOST=0.0.0.0
PORT=8091
NODE_ENV=production
DB_DIALECT=mysql

# For Docker Compose (connects to mariadb container):
DATABASE_URL=mysql://edufika:edufika@mariadb:3306/edufika

# Security settings - UPDATE THESE WITH SECURE VALUES:
JWT_SECRET=<generate-a-strong-random-secret>
WS_AUTH_TOKEN=<generate-a-strong-random-token>
ADMIN_CREATE_KEY=<generate-a-strong-random-key>

# Token settings
DEFAULT_TOKEN_TTL_MINUTES=120
ACCESS_SIGNATURE_TTL_SECONDS=300

# Heartbeat settings
HEARTBEAT_TIMEOUT_SECONDS=30
HEARTBEAT_WATCH_INTERVAL_SECONDS=5
RISK_LOCK_THRESHOLD=12

# Security
REQUIRE_HTTPS=true
DEFAULT_WHITELIST=https://edufika.techivibes.com,https://example.org
```

**Generate secure secrets:**
```
bash
# Run on your local machine or VPS
openssl rand -hex 64  # For JWT_SECRET
openssl rand -hex 64  # For WS_AUTH_TOKEN  
openssl rand -hex 64  # For ADMIN_CREATE_KEY
```

---

## Step 3: Start All Services

The docker-compose.yml includes MariaDB, phpMyAdmin, and the API application.

```
bash
# Navigate to the project directory
cd edufika-session-api

# Build and start all containers
docker compose up -d --build

# View logs
docker compose logs -f
```

**Services started:**
- MariaDB: `localhost:3307` (container port 3306 exposed as 3307)
- phpMyAdmin: `http://localhost:8089` (user: root, password: rootpass)
- API: `http://localhost:8091`

---

## Step 4: Verify Deployment

```
bash
# Check container status
docker compose ps

# Test health endpoint
curl http://localhost:8091/health
```

Expected response:
```
json
{"ok":true,"service":"edufika-session-api","now":"2024-..."}
```

**Database migrations** run automatically when the container starts.

---

## Step 5: Configure Nginx Reverse Proxy

For domain access and SSL:

```
bash
# Install nginx
sudo apt install nginx

# Create Nginx config
sudo nano /etc/nginx/sites-available/edufika
```

Add this configuration:
```nginx
server {
    listen 80;
    server_name edufika.techivibes.com;

    location / {
        proxy_pass http://localhost:8091;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable and restart:
```
bash
sudo ln -s /etc/nginx/sites-available/edufika /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## Step 6: Set Up SSL with Let's Encrypt

```
bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d edufika.techivibes.com
```

---

## Step 7: Firewall Configuration

```
bash
# Allow necessary ports
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS
sudo ufw enable
```

---

## Quick Commands

```
bash
# Start services
docker compose up -d

# Stop services
docker compose down

# View logs
docker compose logs -f app

# Rebuild and restart
docker compose up -d --build

# Restart after git pull
git pull
docker compose down
docker compose build --no-cache
docker compose up -d
```

---

## Production Checklist

- [ ] Environment variables updated with secure secrets
- [ ] Database migrations run successfully
- [ ] Health endpoint tested: `curl http://localhost:8091/health`
- [ ] Nginx reverse proxy configured
- [ ] SSL certificate installed (Let's Encrypt)
- [ ] Firewall configured
- [ ] Domain pointing to VPS IP

---

## Troubleshooting

**Database Connection Issues:**
```
bash
# Check MariaDB logs
docker compose logs mariadb

# Test connection from app container
docker compose exec app sh -c 'nc -zv mariadb 3306'
```

**Container Issues:**
```
bash
# View app logs
docker compose logs app

# Check environment variables
docker compose exec app env
