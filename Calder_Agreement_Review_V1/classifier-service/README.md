# Optional CUAD-trained classifier service

This FastAPI service hosts a CUAD-fine-tuned question-answering checkpoint separately from the Vercel application. It is optional: Calder automatically uses deterministic candidate retrieval when this service and the OpenAI extractor are unavailable, and the guided manual workflow always remains available.

The repository does **not** silently substitute a generic model. Set `CUAD_MODEL_PATH` to a checkpoint actually fine-tuned on CUAD, such as a local checkpoint produced with the official CUAD training repository. This makes the provenance of model results explicit.

## Run with Python

```bash
cd classifier-service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

export CUAD_MODEL_PATH=/absolute/path/to/cuad-checkpoint
export CUAD_CLASSIFIER_TOKEN=replace-with-a-long-random-value
uvicorn app:app --host 0.0.0.0 --port 8000
```

## Run with Docker

Build from the application root so the taxonomy file is available:

```bash
docker build -f classifier-service/Dockerfile -t calder-cuad-classifier .
docker run --rm -p 8000:8000 \
  -e CUAD_MODEL_PATH=/models/cuad-checkpoint \
  -e CUAD_CLASSIFIER_TOKEN=replace-with-a-long-random-value \
  -v /absolute/path/to/models:/models:ro \
  calder-cuad-classifier
```

## Connect Vercel

Add these server-only environment variables:

```env
CUAD_CLASSIFIER_URL=https://your-classifier.example.com
CUAD_CLASSIFIER_TOKEN=the-same-random-value
```

Do not prefix either variable with `VITE_`. Vercel calls the service through `/api/analyze`; contract text does not go directly from the browser to the classifier host.

The service returns only provision presence and supporting text. Its raw model score is used only as an internal candidate threshold and is not exposed as calibrated confidence. Calder's client derives the displayed confidence indicator from source-span verification and independent deterministic agreement. The service does not return values, severity, deviations, gaps, or legal conclusions.
