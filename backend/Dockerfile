FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt --prefer-binary

COPY . .

RUN mkdir -p /data /app/logs

EXPOSE 8080

# Use shell form (not exec form) so $PORT gets expanded
CMD python -m uvicorn main:app --host 0.0.0.0 --port $PORT
