/**
 * rendererFactory.js
 *
 * Factory that selects the correct renderer based on the tutorial type
 * found in the Gemini-generated JSON.
 *
 * Usage:
 *   const factory = require('./renderer/rendererFactory');
 *   const renderer = factory.getRenderer('aws');   // → AWSRenderer instance
 *   const renderer = factory.getRenderer('programming'); // → VSCodeRenderer
 */

const rendererConfig = require('../config/renderer.config');

// Lazy-loaded renderer cache (singletons per type)
const _instances = {};

/**
 * Return a renderer instance for the given tutorial type.
 * Creates the instance on first call, caches it thereafter.
 *
 * @param {string} type - Tutorial type from Gemini JSON ('programming', 'aws', etc.)
 * @returns {BaseRenderer} - An initialized renderer instance
 */
function getRenderer(type) {
  const resolvedType = (type || '').toLowerCase().trim();
  const key = rendererConfig.renderers[resolvedType]
    ? resolvedType
    : rendererConfig.defaultType;

  if (_instances[key]) {
    return _instances[key];
  }

  const modulePath = rendererConfig.renderers[key];
  if (!modulePath) {
    throw new Error(
      `No renderer registered for type "${key}". ` +
      `Available types: ${Object.keys(rendererConfig.renderers).join(', ')}`
    );
  }

  const RendererClass = require(modulePath);
  _instances[key] = new RendererClass();
  return _instances[key];
}

/**
 * List all registered renderer types.
 * @returns {string[]}
 */
function getAvailableTypes() {
  return Object.keys(rendererConfig.renderers);
}

/**
 * Check if a renderer exists for the given type.
 * @param {string} type
 * @returns {boolean}
 */
function hasRenderer(type) {
  return !!rendererConfig.renderers[(type || '').toLowerCase().trim()];
}

module.exports = {
  getRenderer,
  getAvailableTypes,
  hasRenderer,
};
