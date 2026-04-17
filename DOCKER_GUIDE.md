# Docker Setup Guide - StrataNodex Backend

## ✅ Setup Complete!

Your Docker environment is now fully configured and Redis is running.

---

## 🎯 What's Been Set Up

### **Files Created**

1. ✅ **`Dockerfile`** - Multi-stage production build
2. ✅ **`docker-compose.yml`** - Development orchestration (API + Redis)
3. ✅ **`docker-compose.prod.yml`** - Production overrides
4. ✅ **`.dockerignore`** - Optimized build context
5. ✅ **`render.yaml`** - Deployment configuration
6. ✅ **`.github/workflows/docker-build.yml`** - CI/CD pipeline

### **Code Updates**

1. ✅ **`src/app.ts`** - Added `/health` endpoint for Docker health checks
2. ✅ **`package.json`** - Added Docker convenience scripts

### **Running Services**

- ✅ **Redis** - Running on `localhost:6379` (healthy)
- ✅ **Network** - `stratanodex-backend_stratanodex-network` created
- ✅ **Volume** - `stratanodex-backend_redis-data` for persistence

---

## 📋 Quick Reference Commands

### **Daily Development**

```bash
# Start development environment (API + Redis with hot reload)
npm run docker:dev

# Start in background (detached mode)
docker-compose up -d

# View logs in real-time
npm run docker:logs

# Stop everything
npm run docker:down

# Rebuild after dependency changes
npm run docker:dev:build
```

### **Redis Only**

```bash
# Start just Redis (already running!)
npm run docker:redis

# Test Redis connection
docker exec stratanodex-redis redis-cli ping
# Expected: PONG

# Access Redis CLI
docker exec -it stratanodex-redis redis-cli
# Inside CLI: SET test "hello" → GET test → EXIT
```

### **Production Testing**

```bash
# Build and run production version (port 3001)
npm run docker:prod

# Stop production containers
npm run docker:prod:down
```

### **Debugging**

```bash
# See running containers
docker ps

# See all containers (including stopped)
docker ps -a

# View API logs
docker logs stratanodex-api

# Follow logs in real-time
docker logs -f stratanodex-api

# Execute shell in running container
docker exec -it stratanodex-api sh

# Inside container:
ls -la
cat .env
npm --version
exit
```

### **Cleanup**

```bash
# Stop and remove containers
docker-compose down

# Remove containers + volumes (⚠️ deletes Redis data)
docker-compose down -v

# Remove unused images
docker image prune

# Nuclear option - remove everything Docker
docker system prune -a
```

---

## 🚀 Next Steps - Start Full Development Stack

### **Option 1: Start API + Redis Together**

```bash
# This will:
# 1. Start Redis (already running)
# 2. Build and start your API in development mode
# 3. Enable hot reload (changes auto-restart)
npm run docker:dev
```

**What you'll see:**
```
[+] Running 2/2
 ✔ Container stratanodex-redis  Running
 ✔ Container stratanodex-api    Started

stratanodex-redis | Ready to accept connections
stratanodex-api   | StrataNodex API running on port 3000
```

**Test it:**
```bash
# In another terminal
curl http://localhost:3000/health

# Expected:
{"status":"ok","timestamp":"2026-04-18T00:15:00.000Z"}
```

### **Option 2: Run API Locally (without Docker)**

```bash
# Redis is already running in Docker
# Just start your API normally
npm run dev

# Your .env REDIS_URL=redis://localhost:6379 will connect to Docker Redis
```

---

## 🔧 How It Works

### **Development Mode** (`docker-compose up`)

```yaml
api:
  volumes:
    - ./src:/app/src        # Your code is mounted
    - ./prisma:/app/prisma  # Prisma schema mounted
  command: npm run dev      # Runs ts-node-dev (hot reload)
```

**Benefits:**
- ✅ Edit code → auto-restart
- ✅ No need to rebuild image
- ✅ Fast iteration

### **Production Mode** (`docker-compose --profile production up`)

```dockerfile
FROM node:20-alpine AS production
RUN npm ci --only=production  # Only prod dependencies
COPY --from=builder /app/dist # Compiled JavaScript only
CMD ["node", "dist/index.js"] # No TypeScript, no dev tools
```

**Benefits:**
- ✅ Optimized image size
- ✅ Faster startup
- ✅ Matches deployment environment

---

## 📊 Current Status

```bash
# Check what's running
docker ps
```

**Expected Output:**
```
CONTAINER ID   IMAGE            STATUS                   PORTS                    NAMES
5e099821ba4c   redis:7-alpine   Up 2 minutes (healthy)   0.0.0.0:6379->6379/tcp   stratanodex-redis
```

✅ **Redis is ready for Phase 4 (BullMQ)!**

---

## 🎓 Docker Concepts Explained

### **Multi-Stage Build**

Your `Dockerfile` has 2 stages:

1. **Builder** - Installs all deps, compiles TypeScript
2. **Production** - Copies only compiled code + prod deps

**Why?** Final image is ~200MB instead of ~500MB.

### **Health Checks**

```dockerfile
HEALTHCHECK --interval=30s CMD node -e "..."
```

Docker pings `/health` every 30s. If it fails 3 times, container is marked unhealthy.

**Why?** Orchestrators (Kubernetes, Render) can auto-restart unhealthy containers.

### **Volumes**

```yaml
volumes:
  - redis-data:/data  # Persists Redis data
  - ./src:/app/src    # Mounts your code for hot reload
```

**Why?** Data survives container restarts. Code changes reflect instantly.

### **Networks**

```yaml
networks:
  - stratanodex-network
```

**Why?** Containers can talk to each other by name (`redis://redis:6379`).

---

## 🚢 Deployment (Phase 6)

### **Render (Recommended)**

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Add Docker setup"
   git push origin main
   ```

2. **Connect Render**
   - Go to [render.com](https://render.com)
   - New → Blueprint
   - Connect your GitHub repo
   - Render reads `render.yaml` automatically

3. **Set Environment Variables**
   - Dashboard → stratanodex-api → Environment
   - Add `DATABASE_URL` (from Neon)
   - `JWT_SECRET` is auto-generated
   - `REDIS_URL` is auto-linked from Redis service

4. **Deploy!**
   - Render builds your Dockerfile
   - Starts API + Redis
   - Gives you a URL: `https://stratanodex-api.onrender.com`

### **GitHub Actions**

Every push to `main` triggers:
1. ✅ TypeScript type check
2. ✅ Docker build test
3. ✅ Deployment to Render

**Setup:**
- GitHub repo → Settings → Secrets
- Add `RENDER_DEPLOY_HOOK` (from Render dashboard)

---

## 🐛 Troubleshooting

### **"Cannot connect to Redis"**

```bash
# Check if Redis is running
docker ps | grep redis

# If not running, start it
npm run docker:redis

# Test connection
docker exec stratanodex-redis redis-cli ping
```

### **"Port 6379 already in use"**

```bash
# Something else is using port 6379
# Option 1: Stop the other service
# Option 2: Change port in docker-compose.yml:
ports:
  - "6380:6379"  # Use 6380 instead
```

### **"Hot reload not working"**

```bash
# Rebuild the dev container
npm run docker:dev:build
```

### **"Docker daemon not running"**

```bash
# Start Docker Desktop (Windows)
# Check system tray for Docker icon
```

---

## 📚 Learning Resources

- [Docker Docs](https://docs.docker.com/)
- [Docker Compose Docs](https://docs.docker.com/compose/)
- [Multi-Stage Builds](https://docs.docker.com/build/building/multi-stage/)
- [Render Docker Deploy](https://render.com/docs/docker)

---

## ✨ What's Next?

You're now ready for **Phase 4 - BullMQ Jobs**!

Redis is running, Docker is configured, and you can start implementing:
1. Job queue setup (`src/jobs/queue.ts`)
2. Reminder worker (`src/jobs/reminder.job.ts`)
3. Rollover worker (`src/jobs/rollover.job.ts`)

**To start Phase 4:**
```bash
# Keep Redis running
# Start your API (Docker or local)
npm run docker:dev
# OR
npm run dev

# Begin implementing BullMQ code
```

---

**🎉 Docker setup complete! You're production-ready.**
