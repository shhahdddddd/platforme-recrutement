# RecrutiTN - Docker Deployment Guide

Complete containerized deployment for the RecrutiTN recruitment platform.

## 📁 Created Files

```
recrutement/
├── docker-compose.yml              # Main orchestration file
├── .env.docker                     # Environment template
├── deploy.sh                       # Deployment automation script
├── DOCKER_DEPLOYMENT.md            # This guide
├── ai/
│   ├── Dockerfile                  # AI API (Daphne ASGI)
│   ├── Dockerfile.worker           # Celery worker
│   └── Dockerfile.beat             # Celery scheduler
├── admin/
│   ├── Dockerfile                  # Angular build
│   └── nginx.conf                  # Admin panel config
├── nginx/
│   └── nginx.conf                  # Main reverse proxy
└── backend/
    └── Dockerfile                  # Laravel PHP (already exists)
```

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        NGINX                                 │
│         (Reverse Proxy + SSL + WebSocket Support)           │
│              Ports: 80, 443, 8081 (WS), 8082 (WS)           │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│   Admin       │   │   Backend     │   │   AI          │
│   (Angular)   │   │   (Laravel)   │   │   (Django)    │
│   Port: 80    │   │   Port: 8000  │   │   Port: 8002  │
└───────────────┘   └───────────────┘   └───────────────┘
                              │                     │
                              └──────────┬──────────┘
                                         │
        ┌────────────────────────────────┼────────────────────┐
        │                                │                    │
        ▼                                ▼                    ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────┐
│  PostgreSQL  │   │    Redis     │   │   ChromaDB   │   │ Keycloak │
│   (Database) │   │ (Cache/Queue)│   │  (Vector DB) │   │   (Auth) │
│  Port: 5432  │   │  Port: 6379  │   │  Port: 8003  │   │Port:8080 │
└──────────────┘   └──────────────┘   └──────────────┘   └──────────┘
```

## 🚀 Quick Start

### 1. Prerequisites

```bash
# Install Docker
https://docs.docker.com/get-docker/

# Install Docker Compose
https://docs.docker.com/compose/install/
```

### 2. Configure Environment

```bash
# Copy environment template
cp .env.docker .env

# Edit with your settings
nano .env
```

**Required variables to set:**
- `DB_PASSWORD` - Database password (secure!)
- `KEYCLOAK_PASSWORD` - Keycloak admin password
- `GEMINI_API_KEY` - Get free API key from https://ai.google.dev/

### 3. Deploy

**Option A: Use deployment script**
```bash
chmod +x deploy.sh
./deploy.sh
```

**Option B: Manual commands**
```bash
# Build all images
docker-compose build

# Start infrastructure
docker-compose up -d postgres redis chromadb

# Wait 10 seconds for database
sleep 10

# Start all services
docker-compose up -d

# Run migrations
docker-compose exec backend php artisan migrate --force
docker-compose exec ai python manage.py migrate

# Optimize Laravel
docker-compose exec backend php artisan config:cache
docker-compose exec backend php artisan route:cache
```

## 📋 Service Overview

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| `nginx` | nginx:alpine | 80, 443, 8081, 8082 | Reverse proxy, SSL, WebSockets |
| `postgres` | ankane/pgvector | 5432 | Main database with vector support |
| `redis` | redis:7-alpine | 6379 | Cache, sessions, message broker |
| `chromadb` | chromadb/chroma | 8003 | Vector database for RAG |
| `keycloak` | keycloak:24.0 | 8080 | Authentication & authorization |
| `backend` | Custom (PHP) | 8000 | Laravel API |
| `backend_worker` | Custom (PHP) | - | Queue processor (2 replicas) |
| `backend_scheduler` | Custom (PHP) | - | Cron job runner |
| `ai` | Custom (Python) | 8002 | Django AI API |
| `ai_worker` | Custom (Python) | - | AI task worker (2 replicas) |
| `ai_beat` | Custom (Python) | - | Task scheduler |
| `admin` | Custom (Node) | 4200 | Angular admin panel |

## 🔧 Useful Commands

```bash
# View running services
docker-compose ps

# View logs
docker-compose logs -f                    # All services
docker-compose logs -f backend           # Laravel only
docker-compose logs -f ai                # AI service only

# Execute commands in containers
docker-compose exec backend php artisan migrate
docker-compose exec ai python manage.py shell
docker-compose exec postgres psql -U postgres

# Scale workers
docker-compose up -d --scale backend_worker=4
docker-compose up -d --scale ai_worker=4

# Restart service
docker-compose restart ai

# Stop everything
docker-compose down

# Stop and remove volumes (DATA LOSS!)
docker-compose down -v
```

## 🌐 Access Points

After deployment, access your application at:

| URL | Service |
|-----|---------|
| http://localhost | Main application (via Nginx) |
| http://localhost:4200 | Admin panel (Angular) |
| http://localhost:8000 | Laravel API |
| http://localhost:8002 | AI API |
| http://localhost:8080 | Keycloak admin |
| http://localhost:8081 | Laravel WebSocket |
| http://localhost:8082 | AI WebSocket |

## 🔐 SSL Setup (Production)

### Option 1: Let's Encrypt (Free)

```bash
# Install certbot
docker run -it --rm \
  -v "$(pwd)/nginx/ssl:/etc/letsencrypt" \
  -v "$(pwd)/nginx/www:/var/www/certbot" \
  certbot/certbot certonly \
  --webroot --webroot-path=/var/www/certbot \
  -d yourdomain.com -d www.yourdomain.com

# Uncomment HTTPS section in nginx/nginx.conf
```

### Option 2: Cloudflare (Recommended)

1. Enable "Full (Strict)" SSL in Cloudflare
2. Use Cloudflare Origin Certificates
3. No need for Let's Encrypt

## 📊 Monitoring

```bash
# View resource usage
docker stats

# Check health
docker-compose ps

# View specific service logs
docker-compose logs backend_worker | tail -100
```

## 🆘 Troubleshooting

### Database Connection Failed
```bash
# Check if PostgreSQL is running
docker-compose ps postgres

# View logs
docker-compose logs postgres

# Reset database (DATA LOSS!)
docker-compose down -v postgres
docker-compose up -d postgres
```

### AI Service Not Responding
```bash
# Check if Ollama is running on host
curl http://localhost:11434/api/tags

# Or use external API instead
docker-compose exec ai env | grep GEMINI
```

### WebSocket Connection Failed
```bash
# Check Nginx WebSocket config
docker-compose logs nginx

# Test WebSocket endpoint
curl -i -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Host: localhost" \
  -H "Origin: http://localhost" \
  http://localhost:8081/
```

## 📦 Production Checklist

- [ ] Set secure passwords in `.env`
- [ ] Configure SSL certificates
- [ ] Set up external AI API (Gemini/OpenAI)
- [ ] Configure email SMTP
- [ ] Set up S3/Cloudflare R2 for file storage
- [ ] Configure backup strategy for PostgreSQL
- [ ] Set up monitoring (Prometheus/Grafana)
- [ ] Configure log aggregation
- [ ] Set up CI/CD pipeline
- [ ] Test disaster recovery

## 📞 Support

For issues:
1. Check logs: `docker-compose logs [service]`
2. Verify environment: `docker-compose exec [service] env`
3. Test connectivity: `docker-compose exec backend ping postgres`
