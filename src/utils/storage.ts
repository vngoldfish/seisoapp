export function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function readStorageJson<T>(key: string, fallback: T, storage: Storage | undefined = typeof window !== 'undefined' ? window.localStorage : undefined): T {
  if (!storage) return fallback;

  try {
    return safeJsonParse(storage.getItem(key), fallback);
  } catch {
    return fallback;
  }
}

export function writeStorageJson(key: string, value: unknown, storage: Storage | undefined = typeof window !== 'undefined' ? window.localStorage : undefined): boolean {
  if (!storage) return false;

  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function readStorageString(key: string, fallback = '', storage: Storage | undefined = typeof window !== 'undefined' ? window.localStorage : undefined): string {
  if (!storage) return fallback;

  try {
    return storage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

export function writeStorageString(key: string, value: string, storage: Storage | undefined = typeof window !== 'undefined' ? window.localStorage : undefined): boolean {
  if (!storage) return false;

  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function removeStorageKey(key: string, storage: Storage | undefined = typeof window !== 'undefined' ? window.localStorage : undefined): boolean {
  if (!storage) return false;

  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
