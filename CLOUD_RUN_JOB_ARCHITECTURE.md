# Cloud Run Job Migration Architecture

## Overview
This architecture decouples the long-running video generation workload from the HTTP API server.

```
Frontend (React/Vite)
       │
       ▼
HTTP API Server (Cloud Run Service / Express)
  [POST /api/videos/generate]
       │
       ├─► 1. Save Job record (status = 'queued', payload) in GCS Job Store
       ├─► 2. Trigger Cloud Run Job via REST API (passing VIDEO_JOB_ID)
       └─► 3. Return immediate 202 response ({ jobId, status: 'queued' })
       │
       ▼
Frontend Polling Loop
  [GET /api/videos/status/:jobId]
       │
       ▼
Google Cloud Run Job (Ephemeral Worker Instance)
  [node jobs/videoGeneration.job.js]
       │
       ├─► 1. Load job request from GCS Job Store using VIDEO_JOB_ID
       ├─► 2. Update status to 'processing'
       ├─► 3. Execute teaching script parsing & Gemini/Vertex AI fallback
       ├─► 4. Generate audio via Google Cloud TTS / gTTS
       ├─► 5. Generate real-world scenario visuals (Imagen/Gemini)
       ├─► 6. Render animated screen-share frames with Puppeteer & Chromium
       ├─► 7. Merge video & audio into MP4 with FFmpeg
       ├─► 8. Upload final MP4 & images to GCS
       ├─► 9. Save status = 'completed' with GCS URL
       └─► 10. Clean up /tmp workspace & exit 0
```

## Cloud Run Job Specification

- **Job Name**: `video-generator-job`
- **Region**: `asia-south1`
- **Container Entrypoint**: `node jobs/videoGeneration.job.js`
- **CPU**: `4.0` vCPU (recommended for Puppeteer & FFmpeg concurrent encoding)
- **Memory**: `8Gi` (recommended for headless Chromium DOM rendering and frame capture)
- **Timeout**: `3600s` (60 minutes for long multi-language videos)
- **Max Retries**: `1` (Idempotent job execution checks existing status before reprocessing)

## Environment Variables

| Variable | Description | Example |
| --- | --- | --- |
| `GOOGLE_CLOUD_PROJECT` | GCP Project ID | `sky-meet-01` |
| `GOOGLE_CLOUD_LOCATION` | Vertex AI / Cloud Location | `global` |
| `CLOUD_RUN_JOB_NAME` | Name of the Cloud Run Job | `video-generator-job` |
| `CLOUD_RUN_JOB_REGION` | Cloud Run Job Region | `asia-south1` |
| `GCS_BUCKET_NAME` | Bucket for storing persistent videos & jobs | `sky-meet-01-video-generator` |
| `ENABLE_MULTILINGUAL_AUDIO` | Enable multi-language video generation | `true` |
| `FORCE_LOCAL_JOB` | Force local background worker instead of Cloud Run | `false` |

## IAM & Service Account Requirements

The Service Account attached to the Cloud Run Service API (`video-generator-run@sky-meet-01.iam.gserviceaccount.com`) requires:
1. `roles/run.developer` or `roles/run.admin` (to execute Cloud Run Job)
2. `roles/storage.objectAdmin` (to save job records to GCS bucket)

The Service Account attached to the Cloud Run Job requires:
1. `roles/storage.objectAdmin` (to upload rendered MP4 videos, images & job metadata)
2. `roles/aiplatform.user` (Vertex AI / Gemini script & image generation)
3. `roles/texttospeech.user` (Google Text-to-Speech)

## Deployment Instructions

### 1. Build and Push Container Image to Artifact Registry
```bash
gcloud builds submit --config=server/cloudbuild.yaml .
```

### 2. Create or Update Cloud Run Job
```bash
gcloud run jobs create video-generator-job \
  --image=asia-south1-docker.pkg.dev/sky-meet-01/video-generator/video-generator-backend:latest \
  --region=asia-south1 \
  --tasks=1 \
  --max-retries=1 \
  --cpu=4 \
  --memory=8Gi \
  --task-timeout=3600s \
  --service-account=video-generator-run@sky-meet-01.iam.gserviceaccount.com \
  --set-env-vars="GOOGLE_CLOUD_PROJECT=sky-meet-01,GOOGLE_CLOUD_LOCATION=global,GCS_BUCKET_NAME=sky-meet-01-video-generator,ENABLE_MULTILINGUAL_AUDIO=true"
```

### 3. Grant Job Execution Permissions to API Service Account
```bash
gcloud run jobs add-iam-policy-binding video-generator-job \
  --region=asia-south1 \
  --member="serviceAccount:video-generator-run@sky-meet-01.iam.gserviceaccount.com" \
  --role="roles/run.developer"
```

### 4. Deploy API Cloud Run Service
```bash
gcloud run deploy video-generator-backend \
  --image=asia-south1-docker.pkg.dev/sky-meet-01/video-generator/video-generator-backend:latest \
  --region=asia-south1 \
  --platform=managed \
  --port=5000 \
  --memory=2Gi \
  --cpu=2 \
  --timeout=60s \
  --concurrency=80 \
  --service-account=video-generator-run@sky-meet-01.iam.gserviceaccount.com \
  --set-env-vars="GOOGLE_CLOUD_PROJECT=sky-meet-01,CLOUD_RUN_JOB_NAME=video-generator-job,CLOUD_RUN_JOB_REGION=asia-south1,GCS_BUCKET_NAME=sky-meet-01-video-generator" \
  --allow-unauthenticated
```

## Local Development & Testing

To execute the job script locally against a test job ID:
```bash
# 1. Create a dummy test job record
node -e "require('./services/storage.service').saveJob('test-job-123', { status: 'queued', requestPayload: { text: '[{\"heading\":\"Test\",\"narration\":\"Welcome to testing\",\"bullets\":[\"Code 1\"]}]' } }).then(() => console.log('Saved test job'));"

# 2. Execute the job entrypoint directly
VIDEO_JOB_ID=test-job-123 node jobs/videoGeneration.job.js
```
