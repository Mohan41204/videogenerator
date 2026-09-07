/**
 * storage.service.js
 *
 * Google Cloud Storage (GCS) integration for Video Generator Backend.
 * Handles uploading/downloading permanent video assets, scenario images, metadata JSON, and persistent job status.
 * Gracefully falls back to local storage if GCS_BUCKET_NAME is not configured.
 */

const { Storage } = require('@google-cloud/storage');
const path = require('path');
const fs = require('fs');

class StorageService {
  constructor() {
    this.storage = null;
    this.bucket = null;
    this.localJobsCache = new Map();
  }

  /**
   * Checks whether Google Cloud Storage is configured via environment variable.
   * @returns {boolean}
   */
  isStorageConfigured() {
    return Boolean(process.env.GCS_BUCKET_NAME && process.env.GCS_BUCKET_NAME.trim());
  }

  /**
   * Internal helper to lazy-initialize the GCS Storage and Bucket instances.
   * Uses Application Default Credentials (ADC).
   * @returns {import('@google-cloud/storage').Bucket|null}
   */
  _getBucket() {
    if (!this.isStorageConfigured()) {
      return null;
    }
    if (!this.bucket) {
      try {
        const options = {};
        if (process.env.GOOGLE_CLOUD_PROJECT) {
          options.projectId = process.env.GOOGLE_CLOUD_PROJECT;
        }
        this.storage = new Storage(options);
        const bucketName = process.env.GCS_BUCKET_NAME.trim();
        this.bucket = this.storage.bucket(bucketName);
      } catch (err) {
        console.error('[Storage] Failed to initialize Google Cloud Storage client:', err.message);
        return null;
      }
    }
    return this.bucket;
  }

  /**
   * Uploads a local file to GCS.
   *
   * @param {string} localFilePath - Path to local file
   * @param {string} destinationPath - Object path in GCS (e.g., 'videos/id/english.mp4')
   * @returns {Promise<{ objectName: string, url: string }|null>}
   */
  async uploadFile(localFilePath, destinationPath) {
    if (!this.isStorageConfigured()) {
      console.log('[Storage] GCS not configured — skipping file upload');
      return null;
    }

    const bucket = this._getBucket();
    if (!bucket) {
      throw new Error('[Storage] GCS bucket initialization failed');
    }

    if (!fs.existsSync(localFilePath)) {
      throw new Error(`[Storage] Local file does not exist for upload: ${localFilePath}`);
    }

    console.log(`[Storage] Uploading ${path.basename(localFilePath)} to gs://${process.env.GCS_BUCKET_NAME}/${destinationPath}...`);

    try {
      await bucket.upload(localFilePath, {
        destination: destinationPath,
        resumable: false,
      });

      console.log(`[Storage] Uploaded successfully: gs://${process.env.GCS_BUCKET_NAME}/${destinationPath}`);

      const signedUrl = await this.getSignedUrl(destinationPath);
      const url = signedUrl || `https://storage.googleapis.com/${process.env.GCS_BUCKET_NAME}/${destinationPath}`;

      return {
        objectName: destinationPath,
        url
      };
    } catch (err) {
      console.error(`[Storage] Failed to upload file ${localFilePath} to ${destinationPath}:`, err.message);
      throw new Error(`[Storage] Failed to upload ${path.basename(localFilePath)}: ${err.message}`);
    }
  }

  /**
   * Uploads a Buffer directly to GCS.
   *
   * @param {Buffer} buffer - File buffer
   * @param {string} destinationPath - Object path in GCS
   * @param {string} contentType - MIME type (e.g. 'image/jpeg', 'application/json')
   * @returns {Promise<{ objectName: string, url: string }|null>}
   */
  async uploadBuffer(buffer, destinationPath, contentType = 'application/octet-stream') {
    if (!this.isStorageConfigured()) {
      console.log('[Storage] GCS not configured — skipping buffer upload');
      return null;
    }

    const bucket = this._getBucket();
    if (!bucket) {
      throw new Error('[Storage] GCS bucket initialization failed');
    }

    console.log(`[Storage] Uploading buffer (${buffer.length} bytes) to gs://${process.env.GCS_BUCKET_NAME}/${destinationPath}...`);

    try {
      const file = bucket.file(destinationPath);
      await file.save(buffer, {
        contentType,
        resumable: false,
      });

      console.log(`[Storage] Uploaded buffer successfully: gs://${process.env.GCS_BUCKET_NAME}/${destinationPath}`);

      const signedUrl = await this.getSignedUrl(destinationPath);
      const url = signedUrl || `https://storage.googleapis.com/${process.env.GCS_BUCKET_NAME}/${destinationPath}`;

      return {
        objectName: destinationPath,
        url
      };
    } catch (err) {
      console.error(`[Storage] Failed to upload buffer to ${destinationPath}:`, err.message);
      throw new Error(`[Storage] Failed to upload buffer: ${err.message}`);
    }
  }

  /**
   * Downloads an object from GCS to a local file path.
   *
   * @param {string} destinationPath - GCS object path
   * @param {string} localFilePath - Local destination path
   * @returns {Promise<string>} - Returns localFilePath
   */
  async downloadFile(destinationPath, localFilePath) {
    if (!this.isStorageConfigured()) {
      throw new Error('[Storage] GCS not configured');
    }

    const bucket = this._getBucket();
    if (!bucket) {
      throw new Error('[Storage] GCS bucket initialization failed');
    }

    console.log(`[Storage] Downloading gs://${process.env.GCS_BUCKET_NAME}/${destinationPath} to ${localFilePath}...`);

    const dir = path.dirname(localFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    try {
      await bucket.file(destinationPath).download({ destination: localFilePath });
      console.log(`[Storage] Downloaded gs://${process.env.GCS_BUCKET_NAME}/${destinationPath} to ${localFilePath}`);
      return localFilePath;
    } catch (err) {
      console.error(`[Storage] Failed to download ${destinationPath}:`, err.message);
      throw err;
    }
  }

  /**
   * Deletes an object from GCS.
   *
   * @param {string} destinationPath - GCS object path
   * @returns {Promise<boolean>}
   */
  async deleteFile(destinationPath) {
    if (!this.isStorageConfigured()) return false;

    const bucket = this._getBucket();
    if (!bucket) return false;

    console.log(`[Storage] Deleting gs://${process.env.GCS_BUCKET_NAME}/${destinationPath}...`);
    try {
      await bucket.file(destinationPath).delete({ ignoreNotFound: true });
      return true;
    } catch (err) {
      console.error(`[Storage] Failed to delete ${destinationPath}:`, err.message);
      return false;
    }
  }

  /**
   * Checks if an object exists in GCS.
   *
   * @param {string} destinationPath - GCS object path
   * @returns {Promise<boolean>}
   */
  async fileExists(destinationPath) {
    if (!this.isStorageConfigured()) return false;

    const bucket = this._getBucket();
    if (!bucket) return false;

    try {
      const [exists] = await bucket.file(destinationPath).exists();
      return exists;
    } catch (err) {
      console.warn(`[Storage] Error checking existence for ${destinationPath}:`, err.message);
      return false;
    }
  }

  /**
   * Generates a read signed URL for a GCS object using GCS_SIGNED_URL_EXPIRATION_HOURS.
   *
   * @param {string} destinationPath - GCS object path
   * @param {object} options - Additional options for getSignedUrl
   * @returns {Promise<string|null>}
   */
  async getSignedUrl(destinationPath, options = {}) {
    if (!this.isStorageConfigured()) return null;

    const bucket = this._getBucket();
    if (!bucket) return null;

    try {
      const hours = parseInt(process.env.GCS_SIGNED_URL_EXPIRATION_HOURS, 10) || 24;
      const expires = Date.now() + hours * 60 * 60 * 1000;

      const file = bucket.file(destinationPath);
      const [url] = await file.getSignedUrl({
        version: 'v4',
        action: 'read',
        expires,
        ...options
      });
      return url;
    } catch (err) {
      console.warn(`[Storage] Unable to generate v4 signed URL for ${destinationPath}: ${err.message}`);
      return null;
    }
  }

  // ── Persistent Job Store (GCS jobs/{jobId}.json) ──────────────────────────

  /**
   * Saves or updates a job record in GCS (and local memory cache).
   * @param {string} jobId - Unique job ID
   * @param {object} jobData - Job state object
   */
  async saveJob(jobId, jobData) {
    const updatedJob = {
      ...jobData,
      updatedAt: new Date().toISOString()
    };

    // Update local cache
    this.localJobsCache.set(jobId, updatedJob);

    if (!this.isStorageConfigured()) {
      console.log(`[JobStore] Updated job ${jobId}: ${updatedJob.status} (local memory fallback)`);
      return updatedJob;
    }

    const destinationPath = `jobs/${jobId}.json`;
    const buffer = Buffer.from(JSON.stringify(updatedJob, null, 2), 'utf8');

    try {
      const bucket = this._getBucket();
      if (bucket) {
        const file = bucket.file(destinationPath);
        await file.save(buffer, {
          contentType: 'application/json',
          resumable: false
        });
        console.log(`[JobStore] Updated job ${jobId}: ${updatedJob.status}`);
      }
    } catch (err) {
      console.error(`[JobStore] Failed to save job ${jobId} to GCS:`, err.message);
      if (process.env.NODE_ENV === 'production' && updatedJob.status === 'completed') {
        throw new Error(`[JobStore] Critical: Failed to persist completed job state to GCS for ${jobId}: ${err.message}`);
      }
    }

    return updatedJob;
  }

  /**
   * Retrieves a job record from GCS (or in-memory cache).
   * @param {string} jobId - Unique job ID
   * @returns {Promise<object|null>}
   */
  async getJob(jobId) {
    if (!jobId) return null;

    if (this.isStorageConfigured()) {
      const destinationPath = `jobs/${jobId}.json`;
      const bucket = this._getBucket();

      if (bucket) {
        try {
          const file = bucket.file(destinationPath);
          const [exists] = await file.exists();

          if (exists) {
            const [contents] = await file.download();
            const jobData = JSON.parse(contents.toString('utf8'));
            console.log(`[JobStore] Retrieved job ${jobId}: ${jobData.status} (from GCS)`);
            this.localJobsCache.set(jobId, jobData);
            return jobData;
          }
        } catch (err) {
          console.warn(`[JobStore] Failed to read job ${jobId} from GCS: ${err.message}. Checking local cache.`);
        }
      }
    }

    if (this.localJobsCache.has(jobId)) {
      const cached = this.localJobsCache.get(jobId);
      console.log(`[JobStore] Retrieved job ${jobId}: ${cached.status} (from local cache)`);
      return cached;
    }

    console.log(`[JobStore] Job ${jobId} not found`);
    return null;
  }

  /**
   * Deletes a job record from GCS and local cache.
   * @param {string} jobId - Unique job ID
   */
  async deleteJob(jobId) {
    this.localJobsCache.delete(jobId);
    if (this.isStorageConfigured()) {
      const destinationPath = `jobs/${jobId}.json`;
      await this.deleteFile(destinationPath);
    }
  }
}

module.exports = new StorageService();
