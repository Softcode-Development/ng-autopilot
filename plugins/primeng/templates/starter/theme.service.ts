// Light / dark / system theme. The choice is kept in localStorage.theme; `system`
// follows the OS live. The `app-dark` class on <html> switches both PrimeNG
// (darkModeSelector) and Tailwind's `dark:` variant. index.html applies the stored
// choice before the bundle loads, so the first paint is already right.

import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, effect, inject, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'theme';
const DARK_CLASS = 'app-dark';
const MODES: readonly ThemeMode[] = ['light', 'dark', 'system'];

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly window = this.document.defaultView;
  private readonly osDark = signal(this.window?.matchMedia('(prefers-color-scheme: dark)').matches ?? false);

  readonly mode = signal<ThemeMode>(this.storedMode());

  constructor() {
    const query = this.window?.matchMedia('(prefers-color-scheme: dark)');
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
    this.window?.localStorage.setItem(STORAGE_KEY, mode);
  }

  private storedMode(): ThemeMode {
    const stored = this.window?.localStorage.getItem(STORAGE_KEY);
    return MODES.find((m) => m === stored) ?? 'system';
  }
}
