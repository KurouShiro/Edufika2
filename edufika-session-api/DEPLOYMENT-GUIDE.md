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

The `.env` file needs to be updated for production. Create or edit `.env` on your VPS:

```
bash
# Navigate to the project directory
cd edufika-session-api

# Create production .env file
cp .env.example .env
```

Edit `.env` with these production values:

```
env
HOST=0.0.0.0
PORT=8091
NODE_ENV=production
DB_DIALECT=mysql

# IMPORTANT: Update this to connect to your VPS MariaDB
# If using Docker MariaDB: mysql://edufika:edufika@mariadb:3306/edufika
# If using host MariaDB:   mysql://edufika:edufika@localhost:3306/edufika
DATABASE_URL=mysql://edufika:edufika@localhost:3306/edufika

# Generate secure secrets for production:
JWT_SECRET=<generate-a-strong-random-secret>
WS_AUTH_TOKEN=<generate-a-strong-random-token>
ADMIN_CREATE_KEY=<generate-a-strong-random-key>

# Security settings
REQUIRE_HTTPS=true
DEFAULT_WHITELIST=https://edufika.techivibes.com

# Token settings
DEFAULT_TOKEN_TTL_MINUTES=120
ACCESS_SIGNATURE_TTL_SECONDS=300

# Heartbeat settings
HEARTBEAT_TIMEOUT_SECONDS=30
HEARTBEAT_WATCH_INTERVAL_SECONDS=5
RISK_LOCK_THRESHOLD=12
```

**Generate secure secrets:**
```
bash
# Generate random secrets (run on VPS)
openssl rand -hex 64  # For JWT_SECRET
openssl rand -hex 64  # For WS_AUTH_TOKEN  
openssl rand -hex 64  # For ADMIN_CREATE_KEY
```

---

## Step 3: Choose Database Setup

### Option A: Use Existing VPS MariaDB (Recommended)
Since you already have MariaDB running on your VPS, update `.env`:
```
env
DATABASE_URL=mysql://edufika:edufika@host.docker.internal:3306/edufika
```

Note: On Linux, you may need to use the host's internal IP instead of `host.docker.internal`:
```
env
DATABASE_URL=mysql://edufika:edufika@172.17.0.1:3306/edufika
```

### Option B: Use Docker MariaDB
Use the provided `docker-compose.yml` which includes MariaDB:
```
bash
docker compose up -d mariadb
```

---

## Step 4: Build and Run with Docker

### Build the Docker image:
```
bash
docker build -t edufika-session-api .
```

### Run the container:
```
bash
# Run in background
docker run -d \
  --name edufika-session-api \
  -p 8091:8091 \
  --env-file .env \
  edufika-session-api
```

### Or use docker-compose (recommended):
```
bash
# For using Docker's internal MariaDB
docker compose up -d

# For connecting to host MariaDB, create docker-compose.override.yml:
cat > docker-compose.override.yml << 'EOF'
services:
  app:
    build: .
    ports:
      - "8091:8091"
    environment:
      - NODE_ENV=production
    env_file:
      - .env
    extra_hosts:
      - "host.docker.internal:host-gateway"
EOF

docker compose up -d app
```

---

## Step 5: Run Database Migrations

The Dockerfile already runs migrations automatically (`node dist/db/runMigrations.js`). 

If you need to run them manually:
```
bash
docker exec -it edufika-session-api npm run migrate
```

---

## Step 6: Verify Deployment

Check if the API is running:
```
bash
# Check container status
docker ps

# Check logs
docker logs edufika-session-api

# Test health endpoint
curl http://localhost:8091/health
```

Expected response:
```
json
{"ok":true,"service":"edufika-session-api","now":"2024-..."}
```

---

## Step 7: Configure Nginx Reverse Proxy (Recommended)

For HTTPS and domain access, set up Nginx:

```
bash
# Install nginx
sudo apt install nginx

# Create Nginx config
sudo nano /etc/nginx/sites-available/edufika
```

Add this configuration:
```
nginx
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

## Step 8: Set Up SSL with Let's Encrypt (Recommended)

```
bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d edufika.techivibes.com

# Follow the prompts
```

---

## Step 9: Firewall Configuration

```
bash
# Allow necessary ports
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS
sudo ufw allow 8091  # API (if not behind Nginx)
sudo ufw enable
```

---

## Quick Commands Reference

```
bash
# Start API
docker start edufika-session-api

# Stop API
docker stop edufika-session-api

# View logs
docker logs -f edufika-session-api

# Restart after updates
docker compose down
docker compose build
docker compose up -d

# Update and redeploy
git pull
docker compose down
docker compose build --no-cache
docker compose up -d
```

---

## Production Checklist

- [ ] Environment variables set (JWT_SECRET, WS_AUTH_TOKEN, ADMIN_CREATE_KEY)
- [ ] Database migrations run successfully
- [ ] HTTPS enabled (REQUIRE_HTTPS=true)
- [ ] Firewall configured
- [ ] SSL certificate installed (Let's Encrypt)
- [ ] Nginx reverse proxy configured
- [ ] Health endpoint tested: `curl https://edufika.techivibes.com/health`
- [ ] Logs monitored for errors
- [ ] Backup strategy for database established

---

## Troubleshooting

### Database Connection Issues
```
bash
# Check if MariaDB is running
sudo systemctl status mariadb

# Test connection
mysql -u edufika -p -h localhost edufika
```

### Container Issues
```
bash
# View detailed logs
docker logs edufika-session-api

# Check environment variables inside container
docker exec edufika-session-api env
```

### Port Already in Use
```
bash
# Check what's using port 8091
sudo lsof -i :8091
