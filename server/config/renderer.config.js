/**
 * renderer.config.js
 *
 * Maps tutorial types to their renderer modules and defines
 * per-renderer output settings.
 *
 * Adding a new platform (e.g. Azure, GCP) is a single entry here
 * plus the renderer file itself.
 */

module.exports = {
  // ── Renderer Type Mappings ───────────────────────────────────────────
  // Key   = value of `type` in the Gemini JSON
  // Value  = relative path to renderer module (from server/renderer/)
  renderers: {
    programming: './vscode.renderer',
    aws:         './aws/aws.renderer',
    // Future:
    // azure:    './azure/azure.renderer',
    // gcp:      './gcp/gcp.renderer',
    // github:   './github/github.renderer',
  },

  // Default renderer when type is missing or unrecognized
  defaultType: 'programming',

  // ── Per-renderer Output Settings ─────────────────────────────────────
  output: {
    programming: {
      fps: 5,
      resolution: { width: 1920, height: 1080 },
      screenshotQuality: 82,
    },
    aws: {
      fps: 5,
      resolution: { width: 1920, height: 1080 },
      screenshotQuality: 85,
    },
  },
};
