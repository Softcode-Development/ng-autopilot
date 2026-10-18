// Light / dark / system theme. The choice is kept in localStorage.theme; `system`
// follows the OS live. The dark class on <html> (__DARK_CLASS__) switches the UI library's
// dark tokens and Tailwind's `dark:` variant. index.html applies the stored
// choice before the bundle loads, so the first paint is already right.

import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, effect, inject, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'theme';
const DARK_CLASS = '__DARK_CLASS__';
const MODES: readonly ThemeMode[] = ['light', 'dark', 'system'];

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly window = this.document.defaultView;
  // No matchMedia on the server or in jsdom test runs: the OS preference then reads as light.
  private readonly query = this.window?.matchMedia?.('(prefers-color-scheme: dark)');
  private readonly osDark = signal(this.query?.matches ?? false);

  readonly mode = signal<ThemeMode>(this.storedMode());

  constructor() {
    const query = this.query;
    const onChange = (event: MediaQueryListEvent): void => this.osDark.set(event.matches);
    query?.addEventListener('change', onChange);
    inject(DestroyRef).onDestroy(() => query?.removeEventListener('change', onChange));

    effect(() => {
      const mode = this.mode();
      const dark = mode === 'dark' || (mode === 'system' && this.osDark());
      this.document.documentElement.classList.toggle(DARK_CLASS, dark);
    });
  }

  setMode(mode: ThemeMode): void {
    this.mode.set(mode);
    try {
      this.window?.localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // Storage blocked (privacy settings): the choice lasts for this session only.
    }
  }

  private storedMode(): ThemeMode {
    let stored: string | null | undefined;
    try {
      stored = this.window?.localStorage.getItem(STORAGE_KEY);
    } catch {
      stored = null;
    }
    return MODES.find((m) => m === stored) ?? 'system';
  }
}
