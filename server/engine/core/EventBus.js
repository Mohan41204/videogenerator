/**
 * core/EventBus.js
 *
 * Central event bus for the AI Tutorial Generation Engine.
 * Decouples modules (e.g., Timeline Engine, Recording Engine, Automation) 
 * by allowing them to communicate via a robust Pub/Sub architecture.
 */

const EventEmitter = require('events');

class EventBus extends EventEmitter {
  constructor() {
    super();
    // Increase max listeners since many modules might listen to high-frequency events (like FRAME_CAPTURED)
    this.setMaxListeners(50);
  }

  static Events = {
    ACTION_STARTED: 'ACTION_STARTED',
    ACTION_FINISHED: 'ACTION_FINISHED',
    FRAME_CAPTURED: 'FRAME_CAPTURED',
    PAGE_CHANGED: 'PAGE_CHANGED',
    AUDIO_PROGRESS: 'AUDIO_PROGRESS',
    TIMELINE_EVENT: 'TIMELINE_EVENT',
    ERROR: 'ERROR',
    RECORDING_STARTED: 'RECORDING_STARTED',
    RECORDING_FINISHED: 'RECORDING_FINISHED'
  };

  /**
   * Publish an event.
   * @param {string} eventName - Use EventBus.Events constants
   * @param {any} payload - Data to pass to listeners
   */
  emit(eventName, payload) {
    if (!Object.values(EventBus.Events).includes(eventName)) {
      console.warn(`[EventBus] Warning: Emitting unregistered event type: ${eventName}`);
    }
    super.emit(eventName, payload);
  }

  /**
   * Subscribe to an event.
   * @param {string} eventName 
   * @param {Function} listener 
   */
  on(eventName, listener) {
    super.on(eventName, listener);
  }

  /**
   * Subscribe to an event once.
   * @param {string} eventName 
   * @param {Function} listener 
   */
  once(eventName, listener) {
    super.once(eventName, listener);
  }
}

// Export a singleton instance for application-wide use
const globalEventBus = new EventBus();

module.exports = {
  EventBus: globalEventBus,
  Events: EventBus.Events
};
