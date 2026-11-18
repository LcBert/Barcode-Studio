#!/usr/bin/env bash
set -e

echo "Waiting for database if required..."
if [ -n "$DB_HOST" ]; then
  until python -c "import socket; s = socket.socket(); s.connect(('$DB_HOST', int('${DB_PORT:-5432}'))); s.close()" 2>/dev/null; do
    echo "Waiting for Postgres at $DB_HOST:${DB_PORT:-5432}..."
    sleep 1
  done
  echo "Postgres is available!"
fi

echo "Applying database migrations..."
python manage.py migrate --noinput

echo "Collecting static files..."
python manage.py collectstatic --noinput || true

echo "Starting server..."
exec "$@"
