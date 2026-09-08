/**
 * cloudRunJob.service.js
 *
 * Service for triggering Google Cloud Run Jobs via official Google Cloud REST API
 * (using google-auth-library / Application Default Credentials) or local direct execution.
 *
 * Standard Cloud Run Jobs API v2 endpoint:
 * POST https://{location}-run.googleapis.com/v2/projects/{project}/locations/{location}/jobs/{job}:run
 */

const { GoogleAuth } = require('google-auth-library');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

class CloudRunJobService {
  constructor() {
    this.auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform']
    });
  }

  /**
   * Triggers the Cloud Run Job for video generation, or falls back to local async process if configured.
   *
   * @param {string} jobId - Unique video job ID stored in database/storage
   * @returns {Promise<{ triggered: boolean, executionName?: string, mode: string }>}
   */
  async triggerVideoJob(jobId) {
    const project = process.env.GOOGLE_CLOUD_PROJECT;
    const location = process.env.CLOUD_RUN_JOB_REGION || process.env.GOOGLE_CLOUD_LOCATION || 'asia-south1';
    const jobName = process.env.CLOUD_RUN_JOB_NAME || 'video-generator-job';
    const forceLocal = process.env.FORCE_LOCAL_JOB === 'true';

    // If local execution is requested or GCP project is not configured, run locally via node child process (dev mode only)
    if (forceLocal || (!project && process.env.NODE_ENV !== 'production')) {
      console.log(`[CloudRunJob] Triggering local background worker for job ${jobId}...`);
      this._runJobLocally(jobId);
      return { triggered: true, mode: 'local' };
    }

    console.log(`[CloudRunJob] Triggering Cloud Run Job "${jobName}" in ${location} for project "${project}" (jobId: ${jobId})...`);

    try {
      const client = await this.auth.getClient();
      // Resolve regional Endpoint: e.g. https://asia-south1-run.googleapis.com
      const endpoint = `https://${location}-run.googleapis.com/v2/projects/${project}/locations/${location}/jobs/${jobName}:run`;

      const requestBody = {
        overrides: {
          containerOverrides: [
            {
              env: [
                {
                  name: 'VIDEO_JOB_ID',
                  value: jobId
                }
              ]
            }
          ]
        }
      };

      const res = await client.request({
        url: endpoint,
        method: 'POST',
        data: requestBody
      });

      console.log(`[CloudRunJob] Cloud Run Job triggered successfully. Execution response:`, res.data?.name || res.status);

      return {
        triggered: true,
        mode: 'cloud_run_job',
        executionName: res.data?.name || undefined
      };
    } catch (err) {
      console.error(`[CloudRunJob] Failed to trigger Cloud Run Job via REST API:`, err.message);
      
      const allowLocalFallback = process.env.NODE_ENV !== 'production' && process.env.ALLOW_LOCAL_FALLBACK === 'true';

      if (allowLocalFallback) {
        console.warn(`[CloudRunJob] Falling back to local worker process for job ${jobId}...`);
        this._runJobLocally(jobId);
        return { triggered: true, mode: 'local_fallback', error: err.message };
      }

      throw new Error(`Cloud Run Job execution failed: ${err.message}`);
    }
  }

  /**
   * Spawns a background Node.js process to run the job locally (for development/testing or fallback).
   * @private
   */
  _runJobLocally(jobId) {
    const jobScriptPath = path.join(__dirname, '../jobs/videoGeneration.job.js');
    
    if (!fs.existsSync(jobScriptPath)) {
      console.error(`[CloudRunJob] Job script file not found at ${jobScriptPath}`);
      return;
    }

    const childEnv = {
      ...process.env,
      VIDEO_JOB_ID: jobId
    };

    const child = spawn(process.execPath, [jobScriptPath], {
      env: childEnv,
      detached: true,
      stdio: 'inherit'
    });

    child.unref();
    console.log(`[CloudRunJob] Spawned local worker process (PID: ${child.pid}) for jobId: ${jobId}`);
  }
}

module.exports = new CloudRunJobService();
