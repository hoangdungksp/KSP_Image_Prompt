/**
 * Vitest setup — mock Chrome extension APIs + IndexedDB + browser-only globals
 * so that components can render in happy-dom without crashing.
 */
import { vi } from "vitest";

// Mock chrome API (extension sidebar context)
(globalThis as any).chrome = {
  storage: {
    local: {
      get: vi.fn(() => Promise.resolve({})),
      set: vi.fn(() => Promise.resolve()),
      remove: vi.fn(() => Promise.resolve()),
    },
    onChanged: { addListener: vi.fn() },
  },
  runtime: {
    sendMessage: vi.fn(() => Promise.resolve()),
    onMessage: { addListener: vi.fn() },
    getURL: (path: string) => `chrome-extension://test/${path}`,
    lastError: null,
  },
  tabs: {
    create: vi.fn(),
    query: vi.fn(() => Promise.resolve([])),
    update: vi.fn(),
    onActivated: { addListener: vi.fn() },
  },
  windows: {
    update: vi.fn(),
  },
  contextMenus: {
    create: vi.fn(),
    removeAll: vi.fn((cb) => cb && cb()),
    onClicked: { addListener: vi.fn() },
  },
  notifications: {
    create: vi.fn(),
  },
  sidePanel: {
    setPanelBehavior: vi.fn(() => Promise.resolve()),
  },
  action: {
    onClicked: { addListener: vi.fn() },
  },
};

// Mock IndexedDB (Dexie needs it)
const fakeIDB = {
  open: vi.fn(() => ({
    onupgradeneeded: null,
    onsuccess: null,
    onerror: null,
    result: {},
  })),
  deleteDatabase: vi.fn(),
};
(globalThis as any).indexedDB = fakeIDB;

// Mock URL.createObjectURL (used in Bundle Export)
if (!(globalThis as any).URL.createObjectURL) {
  (globalThis as any).URL.createObjectURL = vi.fn(() => "blob:mock");
  (globalThis as any).URL.revokeObjectURL = vi.fn();
}

// Mock localStorage (Zustand persist needs it)
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();
Object.defineProperty(globalThis, "localStorage", { value: localStorageMock });
