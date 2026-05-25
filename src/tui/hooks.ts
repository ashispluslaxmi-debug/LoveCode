import { useInput, useStdout } from 'ink';
import { useState, useEffect, useCallback, useRef } from 'react';

export type Direction = 'up' | 'down' | 'left' | 'right';
export type FocusTarget = 'chat' | 'command' | 'repo' | 'input';
export type VimMode = 'normal' | 'insert';

export interface KeyHandler {
  onKey?: (key: string) => void;
  onDirection?: (dir: Direction) => void;
  onEnter?: () => void;
  onEscape?: () => void;
  onTab?: () => void;
  onFocusChange?: (dir: 'next' | 'prev') => void;
}

export function useKeyboard(handler: KeyHandler): void {
  useInput(
    (input, key) => {
      if (key.escape) { handler.onEscape?.(); return; }
      if (key.return) { handler.onEnter?.(); return; }
      if (key.tab) { handler.onTab?.(); return; }

      if (key.upArrow) { handler.onDirection?.('up'); return; }
      if (key.downArrow) { handler.onDirection?.('down'); return; }
      if (key.leftArrow) { handler.onDirection?.('left'); return; }
      if (key.rightArrow) { handler.onDirection?.('right'); return; }

      if (key.ctrl && input === 'n') { handler.onFocusChange?.('next'); return; }
      if (key.ctrl && input === 'p') { handler.onFocusChange?.('prev'); return; }

      handler.onKey?.(input);
    },
    { isActive: true },
  );
}

export function useVimMode(): [VimMode, (mode: VimMode) => void] {
  const [mode, setMode] = useState<VimMode>('insert');

  useInput((input, key) => {
    if (mode === 'normal') {
      if (input === 'i') setMode('insert');
      if (input === 'a') setMode('insert');
      if (input === 'j' || key.downArrow) { /* scroll down */ }
      if (input === 'k' || key.upArrow) { /* scroll up */ }
    } else {
      if (key.escape) setMode('normal');
    }
  });

  return [mode, setMode];
}

export function useTheme(): { theme: string; setTheme: (t: string) => void } {
  const [theme, setThemeState] = useState('default');

  const setThemeFn = useCallback((t: string) => {
    setThemeState(t);
    import('./theme.js').then((mod) => mod.setTheme(t as 'default'));
  }, []);

  return { theme, setTheme: setThemeFn };
}

export interface StreamAnimOptions {
  speed?: number;
  chars?: string[];
}

export function useStreamingText(text: string, options: StreamAnimOptions = {}): string {
  const [displayed, setDisplayed] = useState(0);
  const speed = options.speed || 30;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (displayed >= text.length) return;
    timerRef.current = setInterval(() => {
      setDisplayed((prev) => {
        if (prev >= text.length) {
          if (timerRef.current) clearInterval(timerRef.current);
          return text.length;
        }
        return prev + 1;
      });
    }, speed);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [text, speed]);

  useEffect(() => {
    setDisplayed(0);
  }, [text]);

  return text.slice(0, displayed);
}

export function useSpinner(frames?: string[]): string {
  const spinnerFrames = frames || ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame((prev) => (prev + 1) % spinnerFrames.length);
    }, 80);
    return () => clearInterval(timer);
  }, [spinnerFrames.length]);

  return spinnerFrames[frame];
}

export function useTerminalSize(): { columns: number; rows: number } {
  const { stdout } = useStdout();
  const [size, setSize] = useState({ columns: stdout.columns, rows: stdout.rows });

  useEffect(() => {
    const handleResize = () => {
      setSize({ columns: stdout.columns, rows: stdout.rows });
    };
    stdout.on('resize', handleResize);
    return () => { stdout.off('resize', handleResize); };
  }, [stdout]);

  return size;
}

export function useFocus(): [FocusTarget, (target: FocusTarget) => void] {
  const [focus, setFocus] = useState<FocusTarget>('input');

  useInput((_input, key) => {
    if (key.tab) {
      setFocus((prev) => {
        const order: FocusTarget[] = ['input', 'chat', 'command', 'repo'];
        const idx = order.indexOf(prev);
        return order[(idx + 1) % order.length];
      });
    }
    if (key.shift && key.tab) {
      setFocus((prev) => {
        const order: FocusTarget[] = ['input', 'chat', 'command', 'repo'];
        const idx = order.indexOf(prev);
        return order[(idx - 1 + order.length) % order.length];
      });
    }
  });

  return [focus, setFocus];
}

export interface ScrollState {
  offset: number;
  scrollDown: () => void;
  scrollUp: () => void;
  scrollToBottom: () => void;
  scrollToTop: () => void;
  setMax: (n: number) => void;
  max: number;
}

export function useScroll(): ScrollState {
  const [offset, setOffset] = useState(0);
  const [max, setMax] = useState(0);

  const scrollDown = useCallback(() => {
    setOffset((prev) => Math.min(prev + 1, max));
  }, [max]);

  const scrollUp = useCallback(() => {
    setOffset((prev) => Math.max(prev - 1, 0));
  }, []);

  const scrollToBottom = useCallback(() => {
    setOffset(max);
  }, [max]);

  const scrollToTop = useCallback(() => {
    setOffset(0);
  }, []);

  return { offset, scrollDown, scrollUp, scrollToBottom, scrollToTop, setMax, max };
}
