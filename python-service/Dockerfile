FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for Pillow
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1-mesa-glx libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 5100

CMD ["gunicorn", "--bind", "0.0.0.0:5100", "--workers", "2", "--timeout", "120", "app:app"]
