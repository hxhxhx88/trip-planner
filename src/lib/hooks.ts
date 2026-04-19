import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";

export type DebouncedCallback<A extends unknown[]> = {
  run: (...args: A) => void;
  flush: () => void;
  cancel: () => void;
};

export function useDebouncedCallback<A extends unknown[]>(
  fn: (...args: A) => void,
  ms: number,
): DebouncedCallback<A> {
  const fnRef = useRef(fn);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastArgsRef = useRef<A | null>(null);

  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);

  const cancel = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    lastArgsRef.current = null;
  }, []);

  const flush = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (lastArgsRef.current !== null) {
      const args = lastArgsRef.current;
      lastArgsRef.current = null;
      fnRef.current(...args);
    }
  }, []);

  const run = useCallback(
    (...args: A) => {
      lastArgsRef.current = args;
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        const pending = lastArgsRef.current;
        lastArgsRef.current = null;
        if (pending) fnRef.current(...pending);
      }, ms);
    },
    [ms],
  );

  useEffect(() => cancel, [cancel]);

  return useMemo(() => ({ run, flush, cancel }), [run, flush, cancel]);
}

const LOCAL_STORAGE_EVENT = "travel-tw:localStorage";

function subscribeLocalStorage(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  window.addEventListener(LOCAL_STORAGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(LOCAL_STORAGE_EVENT, callback);
  };
}

export function useKeydown(handler: (e: KeyboardEvent) => void): void {
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  }, [handler]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => ref.current(e);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return false;
}

export function useLocalStorage<T extends string>(
  key: string,
  initial: T,
): [T, (v: T) => void] {
  const getSnapshot = useCallback((): T => {
    try {
      const raw = window.localStorage.getItem(key);
      return (raw ?? initial) as T;
    } catch {
      return initial;
    }
  }, [key, initial]);

  const getServerSnapshot = useCallback((): T => initial, [initial]);

  const value = useSyncExternalStore(
    subscribeLocalStorage,
    getSnapshot,
    getServerSnapshot,
  );

  const set = useCallback(
    (v: T) => {
      try {
        window.localStorage.setItem(key, v);
        window.dispatchEvent(new Event(LOCAL_STORAGE_EVENT));
      } catch {
        // swallow — private mode, unavailable storage, etc.
      }
    },
    [key],
  );

  return [value, set];
}
