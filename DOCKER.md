# Docker Setup for Hi-Lo Game

This document explains how to set up and run the Hi-Lo game server using Docker.

## Prerequisites

### Docker
You have Docker **28.2.2** installed.

### Docker Compose
Docker Compose is **not currently installed** on your system. You need to install it to use the `app.sh` script.

#### Installation Options

**Option 1: Docker Compose V2 (Recommended)**
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install docker-compose-v2

# Verify installation
docker compose version
```

**Option 2: Standalone docker-compose**
```bash
# Download latest version
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose

# Make executable
sudo chmod +x /usr/local/bin/docker-compose

# Verify installation
docker-compose --version
```

**Option 3: Using pip**
```bash
pip install docker-compose
```

## Quick Start

Once Docker Compose is installed:

```bash
# Start the application
./app.sh up

# View logs
./app.sh logs

# Stop the application
./app.sh down
```

## Configuration

### Environment Variables

- `REDIS_DATA_PATH` - Path for Redis persistent data (default: `/var/usr/hilo`)
- `REDIS_PORT` - Redis port number (default: `6380`)

### Custom Configuration Example

```bash
# Use custom Redis port and data path
REDIS_PORT=6500 REDIS_DATA_PATH=/custom/path ./app.sh up
```

## Available Commands

| Command | Description |
|---------|-------------|
| `./app.sh up` | Build and start all containers |
| `./app.sh down` | Stop and remove containers |
| `./app.sh restart` | Restart containers |
| `./app.sh rebuild` | Rebuild and recreate containers |
| `./app.sh logs [service]` | View logs (optional: specify `app` or `redis`) |
| `./app.sh status` | Show container status |
| `./app.sh exec <service> <cmd>` | Execute command in container |
| `./app.sh shell [service]` | Open shell in container |
| `./app.sh clean` | Remove everything (containers, volumes, images) |

## Services

### Application (app)
- **Port:** 3000
- **Health Check:** http://localhost:3000/health
- **Contains:** Node.js backend + React frontend

### Redis (redis)
- **Port:** 6380 (non-default)
- **Data Persistence:** Mounted to host filesystem
- **Configuration:** AOF (Append-Only File) enabled

## Health Checks

Both services have health checks configured:

- **Redis:** Checks connectivity with `redis-cli ping`
- **Application:** Checks HTTP endpoint and Redis connectivity at `/health`

The application will only start after Redis is healthy.

## Troubleshooting

### Docker Compose not found
```bash
# Check if installed
docker compose version
# or
docker-compose --version

# If not, install using one of the methods above
```

### Permission denied on Redis data directory
```bash
# The script automatically creates the directory, but if you have issues:
sudo mkdir -p /var/usr/hilo
sudo chmod 777 /var/usr/hilo
```

### Container fails health check
```bash
# Check container logs
./app.sh logs app
./app.sh logs redis

# Check health status
./app.sh status

# Manually test health endpoint
curl http://localhost:3000/health
```

### Reset everything
```bash
# Remove all containers, volumes, and images
./app.sh clean

# Then start fresh
./app.sh up
```

## Architecture

The setup uses a multi-stage Docker build:

1. **Builder Stage:** Compiles TypeScript code for shared, backend, and frontend
2. **Production Stage:** Creates minimal runtime image with only compiled code and production dependencies

This results in a smaller, more secure production image.

## Network

Containers communicate via a dedicated bridge network (`hilo-network`). This allows:
- Application to connect to Redis using hostname `redis`
- Isolation from other Docker containers
- Easy service discovery
