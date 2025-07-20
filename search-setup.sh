#!/bin/bash

# Elasticsearch Search Setup Script for Rspamd Documentation
# This script helps you set up and manage the Elasticsearch search infrastructure

set -e

# Configuration
ELASTICSEARCH_URL="http://localhost:9200"
INDEX_NAME="rspamd-docs"
SITE_URL="http://localhost:3000"
BACKEND_URL="http://localhost:3001"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color
DOCKER_COMPOSE="docker compose"

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

# Function to check if a service is running
check_service() {
    local service_name=$1
    local port=$2
    
    if curl -s "http://localhost:$port" > /dev/null 2>&1; then
        print_status "$service_name is running on port $port"
        return 0
    else
        print_warning "$service_name is not running on port $port"
        return 1
    fi
}

# Function to wait for service to be ready
wait_for_service() {
    local service_name=$1
    local url=$2
    local max_attempts=30
    local attempt=1
    
    print_status "Waiting for $service_name to be ready..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s "$url" > /dev/null 2>&1; then
            print_status "$service_name is ready!"
            return 0
        fi
        
        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    print_error "$service_name failed to start within $((max_attempts * 2)) seconds"
    return 1
}

# Function to start services
start_services() {
    print_header "Starting Elasticsearch Services"
    
    # Check if Docker is running
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
    
    # Start core services
    print_status "Starting Elasticsearch, Kibana, and Search Backend..."
    ${DOCKER_COMPOSE} up -d elasticsearch kibana search-backend
    
    # Wait for Search Backend to be ready (this will ensure Elasticsearch is also ready)
    if ! wait_for_service "Search Backend" "$BACKEND_URL/health"; then
        print_error "Failed to start Search Backend"
        exit 1
    fi
    
    # Wait for Kibana to be ready
    if ! wait_for_service "Kibana" "http://localhost:5601"; then
        print_warning "Kibana might not be ready yet, but continuing..."
    fi
    
    print_status "Services started successfully!"
    print_status "Search Backend: http://localhost:3001 (public API)"
    print_status "Kibana: http://localhost:5601 (localhost admin access)"
    print_status "Elasticsearch: Running internally (not exposed to host)"
}

# Function to start services with auto-indexing
start_with_auto_indexing() {
    print_header "Starting Services with Auto-Indexing"
    
    # Check if Docker is running
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
    
    # Start all services including auto-indexer
    print_status "Starting Elasticsearch, Kibana, Search Backend, and Auto-Indexer..."
    ${DOCKER_COMPOSE} --profile auto-indexing up -d
    
    # Wait for Search Backend to be ready (this will ensure Elasticsearch is also ready)
    if ! wait_for_service "Search Backend" "$BACKEND_URL/health"; then
        print_error "Failed to start Search Backend"
        exit 1
    fi
    
    print_status "Services with auto-indexing started successfully!"
    print_status "Search Backend: http://localhost:3001 (public API)"
    print_status "Kibana: http://localhost:5601 (localhost admin access)"
    print_status "Elasticsearch: Running internally (not exposed to host)"
    print_status "Auto-indexer will run every hour to keep the index updated"
}

# Function to stop services
stop_services() {
    print_header "Stopping Elasticsearch Services"
    
    print_status "Stopping all containers..."
    ${DOCKER_COMPOSE} down
    
    print_status "Services stopped successfully!"
}

# Function to run indexer
run_indexer() {
    print_header "Running Search Indexer"
    
    # Check if Search Backend is running (this ensures Elasticsearch is also running)
    if ! check_service "Search Backend" "3001"; then
        print_error "Search Backend is not running. Please start it first with: $0 start"
        exit 1
    fi
    
    # Check if Docusaurus dev server is running
    if ! check_service "Docusaurus" "3000"; then
        print_warning "Docusaurus dev server is not running on port 3000"
        print_warning "You might want to start it with: npm start"
        print_warning "Continuing with markdown file indexing only..."
    fi
    
    # Run the indexer using the indexing profile
    print_status "Running indexer..."
    ${DOCKER_COMPOSE} --profile indexing run --rm search-indexer
    
    print_status "Indexing completed!"
}

# Function to run lite indexer (without puppeteer)
run_lite_indexer() {
    print_header "Running Lite Search Indexer (Markdown Only)"
    
    # Check if Search Backend is running (this ensures Elasticsearch is also running)
    if ! check_service "Search Backend" "3001"; then
        print_error "Search Backend is not running. Please start it first with: $0 start"
        exit 1
    fi
    
    print_status "Running lite indexer (no browser dependencies)..."
    print_status "This will index markdown files only, skipping rendered pages"
    ${DOCKER_COMPOSE} --profile lite-indexing run --rm search-indexer-lite
    
    print_status "Lite indexing completed!"
}

# Function to check status
check_status() {
    print_header "Service Status Check"
    
    # Check Docker
    if docker info > /dev/null 2>&1; then
        print_status "Docker is running"
    else
        print_error "Docker is not running"
    fi
    
    # Check services
    check_service "Search Backend" "3001"
    check_service "Kibana" "5601"
    check_service "Docusaurus" "3000"
    
    # Check index status via search backend
    if curl -s "$BACKEND_URL/status" > /dev/null 2>&1; then
        local status_response=$(curl -s "$BACKEND_URL/status")
        local doc_count=$(echo "$status_response" | grep -o '"documentCount":[0-9]*' | cut -d: -f2)
        if [ -n "$doc_count" ]; then
            print_status "Index '$INDEX_NAME' exists with $doc_count documents"
        else
            print_warning "Index '$INDEX_NAME' status unclear"
        fi
    else
        print_warning "Cannot check index status - search backend may not be ready"
    fi
}

# Function to reset index
reset_index() {
    print_header "Resetting Search Index"
    
    # Check if Search Backend is running (this ensures Elasticsearch is also running)
    if ! check_service "Search Backend" "3001"; then
        print_error "Search Backend is not running. Please start it first with: $0 start"
        exit 1
    fi
    
    print_status "Deleting existing index..."
    docker exec rspamd-elasticsearch curl -X DELETE "http://localhost:9200/$INDEX_NAME" > /dev/null 2>&1 || true
    
    # Ask user which indexer to use
    echo ""
    echo "Choose indexing method:"
    echo "1) Full indexer (with browser crawling) - may fail on Apple Silicon Macs"
    echo "2) Lite indexer (markdown only) - works everywhere"
    echo ""
    read -p "Enter choice (1 or 2, default: 2): " choice
    
    case "$choice" in
        1)
            print_status "Running full indexer to recreate index..."
            run_indexer
            ;;
        2|"")
            print_status "Running lite indexer to recreate index..."
            run_lite_indexer
            ;;
        *)
            print_error "Invalid choice. Using lite indexer..."
            run_lite_indexer
            ;;
    esac
}

# Function to show logs
show_logs() {
    print_header "Service Logs"
    
    if [ -z "$1" ]; then
        print_status "Showing logs for all services..."
        ${DOCKER_COMPOSE} logs -f
    else
        print_status "Showing logs for service: $1"
        ${DOCKER_COMPOSE} logs -f "$1"
    fi
}

# Function to show usage
show_usage() {
    echo "Usage: $0 {start|start-auto|stop|index|index-lite|status|reset|logs|help}"
    echo ""
    echo "Commands:"
    echo "  start      - Start Elasticsearch, Search Backend, and Kibana services"
    echo "  start-auto - Start services with automatic periodic indexing"
    echo "  stop       - Stop all services"
    echo "  index      - Run the full search indexer (includes browser crawling)"
    echo "  index-lite - Run lite indexer (markdown only, no browser dependencies)"
    echo "  status     - Check the status of all services"
    echo "  reset      - Reset the search index and reindex"
    echo "  logs       - Show logs for all services"
    echo "  help       - Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 start           # Start Elasticsearch, Search Backend, and Kibana"
    echo "  $0 start-auto      # Start with auto-indexing every hour"
    echo "  $0 index           # Index with browser crawling (may fail on Apple Silicon)"
    echo "  $0 index-lite      # Index markdown only (works everywhere)"
    echo "  $0 status          # Check service status"
    echo "  $0 logs elasticsearch  # Show logs for specific service"
    echo ""
    echo "Docker Compose Integration:"
    echo "  All services run in the same Docker Compose environment"
    echo "  - elasticsearch: Search engine (port 9200, internal only)"
    echo "  - search-backend: Secure API proxy (port 3001, public)"
    echo "  - kibana: Management interface (port 5601, localhost only)"
    echo "  - search-indexer: Full indexing with browser crawling"
    echo "  - search-indexer-lite: Markdown-only indexing"
    echo "  - auto-indexer: Periodic indexing (with start-auto)"
    echo ""
    echo "Note: Use 'index-lite' on Apple Silicon Macs to avoid browser issues"
}

# Main script logic
case "$1" in
    start)
        start_services
        ;;
    start-auto)
        start_with_auto_indexing
        ;;
    stop)
        stop_services
        ;;
    index)
        run_indexer
        ;;
    index-lite)
        run_lite_indexer
        ;;
    status)
        check_status
        ;;
    reset)
        reset_index
        ;;
    logs)
        show_logs "$2"
        ;;
    help|--help|-h)
        show_usage
        ;;
    *)
        print_error "Unknown command: $1"
        echo ""
        show_usage
        exit 1
        ;;
esac 
