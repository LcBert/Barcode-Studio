# Justfile for GS1-128 Barcode Generator Project
set quiet
set shell := ["bash", "-uc"]

# Show available commands
default:
    just --list

# ----------------------------------------------------------------------------
# DOCKER CONTAINERS WORKFLOW
# ----------------------------------------------------------------------------

# Build containers images
build:
    docker compose build

# Start all containers in detached mode
up:
    docker compose up -d

# Stop and remove containers and networks
down:
    docker compose down

# Stop containers, remove networks and purge named volumes (clean state)
down-clean:
    docker compose down -v --remove-orphans

# Follow logs of all containers (or specify service e.g. just logs backend)
logs service="":
    docker compose logs -f {{ service }}

# Restart all docker services
restart:
    docker compose restart

# Restart all docker services and clean volumes
restart-clean:
    just down-clean
    just up

# ----------------------------------------------------------------------------
# LOCAL DEVELOPMENT WORKFLOW (uv & npm)
# ----------------------------------------------------------------------------

# Install all dependencies (backend with uv, frontend with npm)
install:
    cd backend && uv sync
    cd frontend && npm install

# Start Django development server locally using uv
run-backend:
    cd backend && uv run python manage.py runserver 0.0.0.0:8000

# Start Angular development server locally with proxy to backend
run-frontend:
    cd frontend && npm start

# ----------------------------------------------------------------------------
# DATABASE & DJANGO UTILITIES
# ----------------------------------------------------------------------------

# Apply Django database migrations locally
migrate:
    cd backend && uv run python manage.py migrate

# Create new Django migrations
makemigrations app="barcodes":
    cd backend && uv run python manage.py makemigrations {{ app }}

# Run Django unit tests
test:
    cd backend && uv run python manage.py test

# Create Django superuser locally
createsuperuser:
    cd backend && uv run python manage.py createsuperuser

# ----------------------------------------------------------------------------
# DOCKER EXEC HELPERS
# ----------------------------------------------------------------------------

# Apply migrations inside the running backend container
docker-migrate:
    docker compose exec backend python manage.py migrate

# Run tests inside the running backend container
docker-test:
    docker compose exec backend python manage.py test

# Open interactive bash in backend container
docker-sh-backend:
    docker compose exec -it backend bash
