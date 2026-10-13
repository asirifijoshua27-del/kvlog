/// <reference types="vite/client" />
import type { KvlogBridge } from '../shared/bridge-types';

declare global {
  interface Window {
    /** Undefined when the UI is opened in a normal browser instead of the KVLOG desktop app. */
    kvlog?: KvlogBridge;
  }
}

export {};
