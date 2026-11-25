import { useEffect, useRef } from 'react';

export interface UseVideoKeyboardShortcutsOptions {
  enabled?: boolean;
  onTogglePlay: () => void;
  onPause?: () => void;
  onSeekBy: (deltaSeconds: number) => void;
  onSeekPercent?: (percent: number) => void;
  onToggleFullScreen: () => void;
  onToggleMute?: () => void;
  onToggleTheater?: () => void;
  onVolumeStep?: (delta: number) => void;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return Boolean(target.closest('[contenteditable="true"]'));
}

export function useVideoKeyboardShortcuts(options: UseVideoKeyboardShortcutsOptions) {
  const { enabled = true } = options;
  const handlersRef = useRef(options);
  handlersRef.current = options;

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (isEditableTarget(e.target)) return;

      const {
        onTogglePlay,
        onPause,
        onSeekBy,
        onSeekPercent,
        onToggleFullScreen,
        onToggleMute,
        onToggleTheater,
        onVolumeStep,
      } = handlersRef.current;

      const key = e.key.toLowerCase();

      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        onTogglePlay();
        return;
      }

      switch (key) {
        case 'k':
          e.preventDefault();
          if (onPause) {
            onPause();
          } else {
            onTogglePlay();
          }
          break;
        case 'j':
          e.preventDefault();
          onSeekBy(-10);
          break;
        case 'l':
          e.preventDefault();
          onSeekBy(10);
          break;
        case 'f':
          e.preventDefault();
          onToggleFullScreen();
          break;
        case 'm':
          e.preventDefault();
          onToggleMute?.();
          break;
        case 't':
          e.preventDefault();
          onToggleTheater?.();
          break;
        case 'arrowleft':
          e.preventDefault();
          onSeekBy(-5);
          break;
        case 'arrowright':
          e.preventDefault();
          onSeekBy(5);
          break;
        case 'arrowup':
          if (onVolumeStep) {
            e.preventDefault();
            onVolumeStep(0.05);
          }
          break;
        case 'arrowdown':
          if (onVolumeStep) {
            e.preventDefault();
            onVolumeStep(-0.05);
          }
          break;
        default:
          if (/^[0-9]$/.test(e.key) && onSeekPercent) {
            e.preventDefault();
            onSeekPercent(Number(e.key) * 10);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled]);
}
