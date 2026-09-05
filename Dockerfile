FROM python:3.11-slim

WORKDIR /app

# Install system dependencies if needed (e.g. for building some wheels)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    ffmpeg \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN groupadd --system --gid 10001 learnus \
    && useradd --system --uid 10001 --gid learnus --home-dir /app learnus \
    && mkdir -p /app/course_files /app/error_log \
    && chown -R learnus:learnus /app

USER learnus

CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8000"]
