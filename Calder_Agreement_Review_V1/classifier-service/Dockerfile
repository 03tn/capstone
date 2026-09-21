FROM python:3.11-slim

WORKDIR /app
COPY classifier-service/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY classifier-service/app.py ./app.py
COPY src/data/cuad-calder-taxonomy.json ./taxonomy.json

ENV PORT=8000
EXPOSE 8000
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
