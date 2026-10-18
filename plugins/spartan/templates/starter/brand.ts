// The active brand: adds `brand-<name>` to <html>, so src/styles/brands/<name>.css applies.
// Register in app.config.ts with the build's brand, e.g. provideBrand(environment.brand).

import { DOCUMENT } from '@angular/common';
import { type EnvironmentProviders, inject, provideEnvironmentInitializer } from '@angular/core';

export function provideBrand(brand: string | null): EnvironmentProviders {
  return provideEnvironmentInitializer(() => {
    if (brand) inject(DOCUMENT).documentElement.classList.add(`brand-${brand}`);
  });
}
