FROM python:3.11-slim

WORKDIR /app

# Install system dependencies including git for repo cloning
RUN apt-get update && apt-get install -y git dos2unix iconv && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

# Convert requirements.txt to UTF-8 to prevent pip parsing errors
RUN iconv -f UTF-16LE -t UTF-8 requirements.txt > requirements_utf8.txt || cp requirements.txt requirements_utf8.txt
RUN pip install --no-cache-dir -r requirements_utf8.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
