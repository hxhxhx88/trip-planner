import { useCallback, useEffect, useMemo, useRef } from "react";

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
