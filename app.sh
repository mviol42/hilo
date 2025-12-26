#!/bin/bash

# Hi-Lo Docker Compose Wrapper
# Thin wrapper around docker-compose for managing the Hi-Lo application

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default configuration
export REDIS_DATA_PATH="${REDIS_DATA_PATH:-/var/usr/hilo}"
export REDIS_PORT="${REDIS_PORT:-6380}"

# Auto-detect Docker Hub username if not set
if [ -z "$DOCKER_USER" ]; then
  DOCKER_USER=$(docker info 2>/dev/null | grep "Username:" | awk '{print $2}')
fi
export DOCKER_USER

# Check if docker-compose is available
check_docker_compose() {
  if command -v docker-compose &> /dev/null; then
    COMPOSE_CMD="docker-compose"
  elif docker compose version &> /dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
  else
    echo -e "${RED}Error: Docker Compose is not installed${NC}"
    echo ""
    echo "Please install Docker Compose:"
    echo "  Ubuntu/Debian: sudo apt install docker-compose-v2"
    echo "  Or via pip: pip install docker-compose"
    echo "  Or download from: https://docs.docker.com/compose/install/"
    exit 1
  fi
}

# Print banner
print_banner() {
  echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║${NC}  ${GREEN}Hi-Lo Game Server${NC}                ${BLUE}║${NC}"
  echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
  echo ""
}

# Parse command
COMMAND="${1:-up}"

case "$COMMAND" in
  up|start)
    print_banner
    check_docker_compose

    echo -e "${YELLOW}Creating Redis data directory...${NC}"
    sudo mkdir -p "$REDIS_DATA_PATH"
    sudo chmod 777 "$REDIS_DATA_PATH"

    echo -e "${YELLOW}Building and starting containers...${NC}"
    $COMPOSE_CMD up -d --build

    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║${NC}  Deployment Complete!                ${GREEN}║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
    echo -e "${BLUE}Application:${NC}   http://localhost:3000"
    echo -e "${BLUE}Health Check:${NC}  http://localhost:3000/health"
    echo -e "${BLUE}Redis Port:${NC}    ${REDIS_PORT}"
    echo -e "${BLUE}Redis Data:${NC}    ${REDIS_DATA_PATH}"
    echo ""
    ;;

  down|stop)
    check_docker_compose
    echo -e "${YELLOW}Stopping containers...${NC}"
    $COMPOSE_CMD down
    echo -e "${GREEN}Containers stopped${NC}"
    ;;

  restart)
    check_docker_compose
    echo -e "${YELLOW}Restarting containers...${NC}"
    $COMPOSE_CMD restart
    echo -e "${GREEN}Containers restarted${NC}"
    ;;

  rebuild)
    check_docker_compose
    echo -e "${YELLOW}Rebuilding containers...${NC}"
    $COMPOSE_CMD up -d --build --force-recreate
    echo -e "${GREEN}Rebuild complete${NC}"
    ;;

  logs)
    check_docker_compose
    SERVICE="${2:-}"
    if [ -z "$SERVICE" ]; then
      $COMPOSE_CMD logs -f
    else
      $COMPOSE_CMD logs -f "$SERVICE"
    fi
    ;;

  status|ps)
    check_docker_compose
    $COMPOSE_CMD ps
    ;;

  exec)
    check_docker_compose
    SERVICE="${2:-app}"
    shift 2
    $COMPOSE_CMD exec "$SERVICE" "$@"
    ;;

  shell)
    check_docker_compose
    SERVICE="${2:-app}"
    echo -e "${BLUE}Opening shell in ${SERVICE}...${NC}"
    $COMPOSE_CMD exec "$SERVICE" /bin/sh
    ;;

  clean)
    check_docker_compose
    echo -e "${YELLOW}Cleaning up all containers, volumes, and images...${NC}"
    $COMPOSE_CMD down -v --rmi all
    echo -e "${GREEN}Cleanup complete${NC}"
    ;;

  pull)
    check_docker_compose
    echo -e "${YELLOW}Pulling latest images...${NC}"
    $COMPOSE_CMD pull
    echo -e "${GREEN}Pull complete${NC}"
    ;;

  push)
    check_docker_compose

    if [ -z "$DOCKER_USER" ]; then
      echo -e "${RED}Error: No Docker user logged in${NC}"
      echo "Please run: docker login"
      exit 1
    fi

    # Get version from package.json
    VERSION=$(grep '"version"' package.json | head -1 | awk -F: '{print $2}' | sed 's/[", ]//g')

    IMAGE_NAME="hilo-app"
    LATEST_TAG="${DOCKER_USER}/${IMAGE_NAME}:latest"
    VERSION_TAG="${DOCKER_USER}/${IMAGE_NAME}:${VERSION}"

    echo -e "${YELLOW}Building image...${NC}"
    docker build \
      --platform linux/amd64 \
      -t "${DOCKER_USER}/hilo-app:build" \
      .

    SOURCE_IMAGE="${DOCKER_USER}/hilo-app:build"

    echo -e "${YELLOW}Tagging image as ${LATEST_TAG}${NC}"
    docker tag "$SOURCE_IMAGE" "$LATEST_TAG"

    echo -e "${YELLOW}Tagging image as ${VERSION_TAG}${NC}"
    docker tag "$SOURCE_IMAGE" "$VERSION_TAG"

    echo -e "${YELLOW}Pushing ${LATEST_TAG}...${NC}"
    docker push "$LATEST_TAG"

    echo -e "${YELLOW}Pushing ${VERSION_TAG}...${NC}"
    docker push "$VERSION_TAG"

    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║${NC}  Push Complete!                      ${GREEN}║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
    echo -e "${BLUE}Images pushed:${NC}"
    echo -e "  - ${LATEST_TAG}"
    echo -e "  - ${VERSION_TAG}"
    echo ""
    ;;

  help|--help|-h)
    print_banner
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  up, start    - Build and start all containers (default)"
    echo "  down, stop   - Stop and remove containers"
    echo "  restart      - Restart all containers"
    echo "  rebuild      - Rebuild and recreate containers"
    echo "  logs [svc]   - Show logs (optionally for specific service: app/redis)"
    echo "  status, ps   - Show container status"
    echo "  exec <svc>   - Execute command in service (e.g., exec app ls)"
    echo "  shell [svc]  - Open shell in service (default: app)"
    echo "  pull         - Pull latest base images"
    echo "  push         - Build, tag, and push image to Docker Hub"
    echo "  clean        - Remove containers, volumes, and images"
    echo "  help         - Show this help message"
    echo ""
    echo "Environment variables:"
    echo "  REDIS_DATA_PATH - Path for Redis data (default: /var/usr/hilo)"
    echo "  REDIS_PORT      - Redis port number (default: 6380)"
    echo ""
    echo "Examples:"
    echo "  $0 up                    # Start the application"
    echo "  $0 logs app              # Follow application logs"
    echo "  $0 exec app npm test     # Run tests in app container"
    echo "  $0 shell redis           # Open shell in Redis container"
    echo "  $0 push                  # Build and push to Docker Hub"
    echo "  REDIS_PORT=6500 $0 up    # Start with custom Redis port"
    echo ""
    ;;

  *)
    check_docker_compose
    # Pass through any other docker-compose commands
    echo -e "${BLUE}Passing through to docker-compose:${NC} $*"
    $COMPOSE_CMD "$@"
    ;;
esac
