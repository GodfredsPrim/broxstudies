# Stage 1: Build Frontend
FROM node:20-slim AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Build Backend
FROM python:3.10-slim
WORKDIR /app

RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

COPY --from=frontend-builder /app/frontend/dist ./frontend/dist
COPY backend/ ./backend/

ENV PYTHONPATH=/app/backend
ENV PORT=8000

CMD cd backend && uvicorn app.main:app --host 0.0.0.0 --port $PORT
