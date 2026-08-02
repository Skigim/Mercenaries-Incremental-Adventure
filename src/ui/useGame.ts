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
  dismissWelcome(): void;
  run(cmd: Command): void;
}

export function useGame(storage: Storage = browserStorage()): Game {
  const [boot] = useState(() => {
    const loaded = load(storage, Math.floor(Math.random() * 2 ** 31));
    // The boot resolution is what the welcome-back summary reports.
    return resolveUpTo(loaded.state, systemClock.now());
  });

  const [state, setState] = useState<GameState>(boot.state);
  const [now, setNow] = useState(() => systemClock.now());
  const [welcomeBack, setWelcomeBack] = useState<GameEvent[] | null>(
    boot.events.length > 0 ? boot.events : null,
  );

  // Re-derive on an interval. This drives progress bars and picks up
  // completions; it is a display concern, never a source of truth.
  useEffect(() => {
    const id = setInterval(() => {
      const t = systemClock.now();
      setNow(t);
      setState((prev) => resolveUpTo(prev, t).state);
    }, RENDER_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => save(storage, state), SAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [state, storage]);

  const run = useCallback((cmd: Command) => {
    setState((prev) => applyCommand(prev, cmd, systemClock.now()).state);
  }, []);

  const dismissWelcome = useCallback(() => setWelcomeBack(null), []);

  return { state, now, welcomeBack, dismissWelcome, run };
}
