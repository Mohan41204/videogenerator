import { ElementHandle, Page } from 'puppeteer';

export interface ActionTarget {
  role?: string;
  name?: string; // Accessible name
  text?: string; // Exact or partial visible text
  testId?: string; // data-testid
  selector?: string; // CSS selector
  xpath?: string; // XPath
  fuzzy?: boolean; // Enable fuzzy matching for text/name
}

export interface ExpectedState {
  element?: ActionTarget;
  urlPattern?: string;
  pageState?: string;
  timeout?: number;
}

export interface AutomationStep {
  action: 'click' | 'type' | 'hover' | 'navigate' | 'verify' | 'select' | 'check' | 'uncheck';
  target?: ActionTarget;
  value?: string; // For typing, selecting, etc.
  expected?: ExpectedState;
}

export interface ElementInfo {
  tagName: string;
  role: string;
  accessibleName: string;
  textContent: string;
  isVisible: boolean;
  isEnabled: boolean;
  isInViewport: boolean;
  isAttached: boolean;
  className: string;
  id: string;
}

export interface CandidateElement {
  elementHandle: ElementHandle;
  score: number;
  info: ElementInfo;
}

export interface ExecutionOptions {
  maxRetries?: number;
  timeout?: number;
  slowMo?: number; // ms to pause before click/type
  recordVideo?: boolean;
}

export interface ExecutionResult {
  success: boolean;
  message: string;
  durationMs: number;
  error?: Error;
}
