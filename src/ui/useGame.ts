import { useCallback, useEffect, useRef, useState } from 'react';
import { applyCommand, type Command } from '../core/commands';
import { resolveUpTo } from '../core/resolve';
import { load, save, type Storage } from '../core/persistence';
import { systemClock } from '../core/clock';
import type { GameEvent, GameState } from '../core/types';

const RENDER_INTERVAL_MS = 500;
const SAVE_DEBOUNCE_MS = 1_000;

function browserStorage(): Storage {
  return {
    getItem: (k) => window.localStorage.getItem(k),
    setItem: (k, v) => window.localStorage.setItem(k, v),
  };
}

export interface Game {
  state: GameState;
  now: number;
  welcomeBack: GameEvent[] | null;
  showWelcome: boolean;
  dismissWelcome(): void;
  run(cmd: Command): GameEvent[];
}

export function useGame(storage: Storage = browserStorage()): Game {
  // Pin the first render's storage: a default parameter re-evaluates on
  // every call, and a fresh identity would churn the autosave effect.
  const storageRef = useRef<Storage | null>(null);
  storageRef.current ??= storage;
  const store = storageRef.current;

  const [boot] = useState(() => {
    const loaded = load(store, Math.floor(Math.random() * 2 ** 31));
    // The boot resolution is what the welcome-back summary reports.
    return resolveUpTo(loaded.state, systemClock.now());
  });

  const [state, setState] = useState<GameState>(boot.state);
  const [now, setNow] = useState(() => systemClock.now());
  const [welcomeBack] = useState<GameEvent[] | null>(
    boot.events.length > 0 ? boot.events : null,
  );
  const [showWelcome, setShowWelcome] = useState(boot.events.length > 0);

  // Re-derive on an interval. This drives progress bars and picks up
  // completions; it is a display concern, never a source of truth.
  // An event-free resolution returns the previous object untouched so
  // idle ticks cannot starve the autosave debounce below.
  useEffect(() => {
    const id = setInterval(() => {
      const t = systemClock.now();
      setNow(t);
      setState((prev) => {
        const resolved = resolveUpTo(prev, t);
        return resolved.events.length === 0 ? prev : resolved.state;
      });
    }, RENDER_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  const stateRef = useRef(state);
  stateRef.current = state;

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      save(store, state);
    }, SAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [state, store]);

  // Flush a pending save on unmount instead of discarding it.
  useEffect(
    () => () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        save(store, stateRef.current);
      }
    },
    [store],
  );

  // Closing the tab does not unmount React components, so the unmount
  // flush above never fires on that path; pagehide does. The ref is
  // nulled after clearing because the page may survive the event (bfcache),
  // and a nulled ref lets the next state change schedule cleanly.
  useEffect(() => {
    const flush = () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
        save(store, stateRef.current);
      }
    };
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, [store]);

  const run = useCallback((cmd: Command): GameEvent[] => {
    const { state: nextState, events } = applyCommand(stateRef.current, cmd, systemClock.now());
    setState(nextState);
    return events;
  }, []);

  const dismissWelcome = useCallback(() => setShowWelcome(false), []);

  return { state, now, welcomeBack, showWelcome, dismissWelcome, run };
}
