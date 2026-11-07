# ==============================================================================
# EI HUB BACKEND PRODUCTION DOCKERFILE (RENDER / LINUX DEPLOYMENT)
# Container with native Tesseract OCR and Poppler utilities
# ==============================================================================

FROM python:3.11-slim

# Avoid prompts from debconf
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# Install system dependencies: Tesseract OCR, English & OSD language packs, and Poppler utilities
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-eng \
    tesseract-ocr-osd \
    poppler-utils \
    libgl1 \
    libglib2.0-0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set default OCR environment paths and Python path for Linux
ENV TESSERACT_CMD=/usr/bin/tesseract
ENV TESSDATA_PREFIX=/usr/share/tesseract-ocr/5/tessdata
ENV POPPLER_PATH=/usr/bin
ENV PYTHONPATH="/app/backend:/app"

# Default port for Render (Render sets PORT=10000 by default)
ENV PORT=10000

# Working directory
WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy backend application code from repository root context
COPY backend/ ./backend/
COPY database/ ./database/
COPY api/ ./api/

# Verify OCR binaries on build
RUN tesseract --version && pdftoppm -v

# Healthcheck targeting Render's dynamic PORT
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD sh -c "curl -f http://localhost:${PORT:-10000}/api/health || exit 1"

EXPOSE 10000

# Run FastAPI backend via Uvicorn listening on 0.0.0.0 and dynamic Render PORT
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-10000}"]
