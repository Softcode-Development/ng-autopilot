---
paths:
  - "**/*.ts"
---

# TypeScript rigor

`tsconfig` strictness is set once (root/base tsconfig) and every app and lib extends it. Target settings:

```jsonc
{
  "compilerOptions": {
    "strict": true,
    "useUnknownInCatchVariables": true,
    "noImplicitOverride": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "noPropertyAccessFromIndexSignature": true,
    "exactOptionalPropertyTypes": true,
    "forceConsistentCasingInFileNames": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true
  },
  "angularCompilerOptions": {
    "strictTemplates": true,
    "strictInjectionParameters": true,
    "strictInputAccessModifiers": true
  }
}
```
A project that cannot reach a setting yet lists it, with the reason, in its ARCHITECTURE.md.

## Hard rules
- **No `any`.** Use `unknown` and narrow. — **Enforcement:** lint `@typescript-eslint/no-explicit-any: error`.
- **`as` casts are restricted** to `as const`, DOM narrowing, and discriminated-union narrowing after a check. — **Enforcement:** review.
- **No `!` non-null assertion** outside a template `@if` block. Use a guard or an `assertDefined()` helper. — **Enforcement:** lint `no-non-null-assertion`.
- **`@ts-expect-error` / `@ts-ignore` only in `*.spec.ts`**, only when deliberately exercising an invalid type, always with a same-line reason: `// @ts-expect-error invalid input under test`. — **Enforcement:** lint `ban-ts-comment` with `allow-with-description`, overridden to error outside specs.
- **Explicit return types on exported functions and public methods.** — **Enforcement:** lint `explicit-module-boundary-types`.
- **No numeric `enum`.** Use string-literal unions or `as const` objects; values match the wire spelling exactly. Numeric enums leak, break tree-shaking and stringify badly.

```ts
export const TransactionDirection = { In: 'in', Out: 'out', Transfer: 'transfer' } as const;
export type TransactionDirection = (typeof TransactionDirection)[keyof typeof TransactionDirection];
```

## Types
- `interface` for object shapes; `type` for unions, intersections, mapped and conditional types. Don't mix styles inside a feature.
- `readonly` on fields never reassigned; `readonly T[]` / `ReadonlyArray<T>` for collections crossing module boundaries.
- Variant data as discriminated unions (`{ kind: 'ok'; value: T } | { kind: 'err'; error: E }`); exhaustive switches end with `assertUnreachable(x: never): never`.
- No `Function`, `Object` or `{}` as types — a specific signature or `Record<string, unknown>`.
- `satisfies` to check a literal against a type without widening it.

## Money and dates
- **Money is never a `number`.** Floats and money do not mix. Wire format: string (or integer minor units). App code: a money value object (`{ amount: bigint /* minor units */, currency }`) with arithmetic through one helper. A project whose API sends money as numbers documents the boundary conversion in its DOMAIN.md.
- **Dates over the wire are ISO-8601 strings.** Timestamps are UTC; display converts to the user's time zone.
- **One date library project-wide**, named in TECH_STACK.md.

## Exempt
`*.spec.ts` for the `@ts-expect-error` rule only.
