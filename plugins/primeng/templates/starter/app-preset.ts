// The app's PrimeNG theme: Aura with project overrides. The one place the look of
// every PrimeNG component is decided (docs/DESIGN_SYSTEM.md § 4).
//
// - Brand colour: change `primary` below to another palette ('{indigo.50}' …) or to
//   your own shades. Surfaces, focus ring and form fields stay Aura's.
// - Keep the preset's structure: a token Aura defines per colour scheme
//   ({ light, dark }) must be overridden per colour scheme too, or the override is ignored.
// - Project tokens live in `extend` as lowercase dot names under `app`
//   (app.income.color → CSS var --p-app-income-color); expose them to Tailwind in
//   src/styles/tailwind.css.
// - A preset made with the PrimeNG Theme Designer or from Figma goes in ./generated/
//   (never edited by hand; run the Designer's Migration Assistant on each PrimeNG
//   major) and replaces Aura as the first argument below.

import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

export const AppPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '{blue.50}',
      100: '{blue.100}',
      200: '{blue.200}',
      300: '{blue.300}',
      400: '{blue.400}',
      500: '{blue.500}',
      600: '{blue.600}',
      700: '{blue.700}',
      800: '{blue.800}',
      900: '{blue.900}',
      950: '{blue.950}',
    },
  },
  extend: {
    // app: {
    //   income: { color: { light: '{green.600}', dark: '{green.400}' } },
    // },
  },
});
