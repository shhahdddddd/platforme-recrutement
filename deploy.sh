#!/bin/bash
# =============================================================================
# RecrutiTN - Production Deployment Script
# =============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}   RecrutiTN Deployment Script${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# =============================================================================
# CHECK PREREQUISITES
# =============================================================================

echo -e "${YELLOW}Checking prerequisites...${NC}"

# Check Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed${NC}"
    exit 1
fi

# Check Docker Compose
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}Error: Docker Compose is not installed${NC}"
    exit 1
fi

# Check .env file exists
if [ ! -f .env ]; then
    echo -e "${RED}Error: .env file not found${NC}"
    echo "Please copy .env.docker to .env and configure your settings:"
    echo "  cp .env.docker .env"
    echo "  nano .env"
    exit 1
fi

echo -e "${GREEN}✓ Prerequisites met${NC}"
echo ""

# =============================================================================
# DEPLOYMENT OPTIONS
# =============================================================================

echo "Select deployment option:"
echo "  1) First-time deployment (builds all images)"
echo "  2) Update deployment (rebuilds changed services)"
echo "  3) Quick restart (no rebuild)"
echo "  4) Stop all services"
echo "  5) View logs"
echo ""
read -p "Enter choice [1-5]: " choice

# =============================================================================
# EXECUTE DEPLOYMENT
# =============================================================================

case $choice in
    1)
        echo -e "${YELLOW}First-time deployment...${NC}"
        
        # Create necessary directories
        mkdir -p nginx/ssl
        mkdir -p backend/storage/logs
        mkdir -p ai/media ai/kb_documents
        
        # Pull latest images
        docker-compose pull
        
        # Build all services
        echo -e "${YELLOW}Building Docker images...${NC}"
        docker-compose build --no-cache
        
        # Start infrastructure first
        echo -e "${YELLOW}Starting infrastructure services...${NC}"
        docker-compose up -d postgres redis chromadb
        
        # Wait for database
        echo -e "${YELLOW}Waiting for database to be ready...${NC}"
        sleep 10
        
        # Start remaining services
        echo -e "${YELLOW}Starting application services...${NC}"
        docker-compose up -d
        
        # Run migrations
        echo -e "${YELLOW}Running Laravel migrations...${NC}"
        docker-compose exec backend php artisan migrate --force
        
        echo -e "${YELLOW}Running Django migrations...${NC}"
        docker-compose exec ai python manage.py migrate
        
        # Optimize Laravel
        echo -e "${YELLOW}Optimizing Laravel...${NC}"
        docker-compose exec backend php artisan config:cache
        docker-compose exec backend php artisan route:cache
        docker-compose exec backend php artisan view:cache
        
        echo -e "${GREEN}✓ Deployment complete!${NC}"
        echo ""
        echo "Services available at:"
        echo "  - Main App:     http://localhost"
        echo "  - Admin Panel:  http://localhost:4200"
        echo "  - Backend API:  http://localhost:8000"
        echo "  - AI Service:   http://localhost:8002"
        echo "  - Keycloak:     http://localhost:8080"
        echo "  - ChromaDB:     http://localhost:8003"
        ;;
    
    2)
        echo -e "${YELLOW}Updating deployment...${NC}"
        
        # Build with cache
        docker-compose build
        
        # Rolling update
        docker-compose up -d --no-deps --build backend
        docker-compose up -d --no-deps --build ai
        docker-compose up -d --no-deps --build admin
        
        echo -e "${GREEN}✓ Update complete${NC}"
        ;;
    
    3)
        echo -e "${YELLOW}Quick restart...${NC}"
        docker-compose restart
        echo -e "${GREEN}✓ Services restarted${NC}"
        ;;
    
    4)
        echo -e "${YELLOW}Stopping all services...${NC}"
        docker-compose down
        echo -e "${GREEN}✓ Services stopped${NC}"
        ;;
    
    5)
        echo "Select service to view logs:"
        echo "  1) All services"
        echo "  2) Backend (Laravel)"
        echo "  3) AI Service"
        echo "  4) Database"
        read -p "Enter choice [1-4]: " log_choice
        
        case $log_choice in
            1) docker-compose logs -f ;;
            2) docker-compose logs -f backend ;;
            3) docker-compose logs -f ai ;;
            4) docker-compose logs -f postgres ;;
            *) docker-compose logs -f ;;
        esac
        ;;
    
    *)
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac

# =============================================================================
# HEALTH CHECK
# =============================================================================

if [ "$choice" == "1" ] || [ "$choice" == "2" ] || [ "$choice" == "3" ]; then
    echo ""
    echo -e "${YELLOW}Running health checks...${NC}"
    
    # Check if services are running
    services=("postgres" "redis" "backend" "ai" "nginx")
    all_healthy=true
    
    for service in "${services[@]}"; do
        if docker-compose ps | grep -q "$service.*Up"; then
            echo -e "  ${GREEN}✓${NC} $service"
        else
            echo -e "  ${RED}✗${NC} $service (not running)"
            all_healthy=false
        fi
    done
    
    if [ "$all_healthy" = true ]; then
        echo ""
        echo -e "${GREEN}========================================${NC}"
        echo -e "${GREEN}   All services are healthy!${NC}"
        echo -e "${GREEN}========================================${NC}"
    else
        echo ""
        echo -e "${RED}========================================${NC}"
        echo -e "${RED}   Some services are not running${NC}"
        echo -e "${RED}   Run: docker-compose logs [service]${NC}"
        echo -e "${RED}========================================${NC}"
    fi
fi

echo ""
echo "Useful commands:"
echo "  docker-compose ps          - View running services"
echo "  docker-compose logs [svc]  - View service logs"
echo "  docker-compose exec [svc]  - Execute command in container"
echo "  docker stats               - View resource usage"
