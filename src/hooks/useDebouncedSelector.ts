/**
 * useDebouncedSelector — subscribe to Redux but only re-render after
 * dispatches settle down (debounce window). This prevents the "thundering
 * herd" problem where 34 rapid fetchEvmBalance dispatches each cause
 * an individual re-render.
 *
 * For data that changes in bursts (balances, prices) but where the UI
 * only needs the final result, this collapses N re-renders into 1.
 */
import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { store } from "../store";
import type { RootState } from "../store";

export function useDebouncedSelector<T>(
  selector: (state: RootState) => T,
  delayMs = 300
): T {
  const [value, setValue] = useState<T>(() => selector(store.getState()));
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const selectorRef = useRef(selector);
  const needsSyncRef = useRef(false);
  selectorRef.current = selector;

  useEffect(() => {
    // Immediately sync on mount
    setValue(selectorRef.current(store.getState()));

    const syncIfActive = () => {
      if (AppState.currentState === "active" && needsSyncRef.current) {
        needsSyncRef.current = false;
        setValue(selectorRef.current(store.getState()));
      }
    };

    const appStateSub = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        syncIfActive();
      }
    });

    const unsubscribe = store.subscribe(() => {
      if (AppState.currentState !== "active") {
        needsSyncRef.current = true;
        return;
      }

      // Clear any pending update
      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      // Schedule a single update after the dispatch storm settles
      timeoutRef.current = setTimeout(() => {
        if (AppState.currentState === "active") {
          const next = selectorRef.current(store.getState());
          setValue(next);
        } else {
          needsSyncRef.current = true;
        }
      }, delayMs);
    });

    return () => {
      unsubscribe();
      appStateSub.remove();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [delayMs]);

  return value;
}
