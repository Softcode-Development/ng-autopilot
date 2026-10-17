// PrimeNG, configured once for the whole app: register PRIMENG_PROVIDERS in app.config.ts.

import { providePrimeNG } from 'primeng/config';

import { AppPreset } from './app-preset';

export const PRIMENG_PROVIDERS = providePrimeNG({
  theme: {
    preset: AppPreset,
    options: {
      prefix: 'p',
      darkModeSelector: __DARK_SELECTOR__,
      cssLayer: __CSS_LAYER__,
    },
  },
});
