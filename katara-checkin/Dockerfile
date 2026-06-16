# Standard container image — build from this directory as the context:
#
#     docker build -t katara-checkin .
#     docker run -p 8000:8000 katara-checkin
#     # open http://localhost:8000
#
# For Hugging Face Spaces use the one-file Dockerfile in DEPLOY.md instead
# (it clones the app, so you only paste a single file into the Space).
FROM python:3.11-slim

# System libraries needed by OpenCV / onnxruntime.
RUN apt-get update && apt-get install -y --no-install-recommends \
        libglib2.0-0 libgl1 libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt requirements-face.txt ./
RUN pip install --no-cache-dir -r requirements.txt -r requirements-face.txt

COPY . .

# Pre-download the ArcFace model (~280 MB) so the first scan is instant.
RUN python -c "from insightface.app import FaceAnalysis; a=FaceAnalysis(name='buffalo_l', allowed_modules=['detection','recognition']); a.prepare(ctx_id=-1, det_size=(640,640))"

ENV PYTHONPATH=/app
EXPOSE 8000
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
