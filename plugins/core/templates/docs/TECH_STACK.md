# Tech Stack

<!-- guide: what the project uses and why. Versions are exact as installed; "Why" is the reason an agent should not swap it. For a repo with legacy code, list the stack new code uses and mark legacy-only libraries as such (never to be used by new code). Library discussions and cost analysis are optional appendices. -->

## Stack

| Layer | Choice (version) | Why |
|---|---|---|
| Framework | Angular <x.y> — <standalone/signals/zoneless status> | |
| UI library | <library + version> | |
| Styling | <Tailwind / SCSS + tokens / …> | |
| Server state | <library> | |
| Client state | <mechanism> | |
| Forms / validation | <Reactive Forms + schema lib> | |
| i18n | <library> — locales: <list>; source of truth: <locale> | |
| HTTP / API client | <generated client / services> | |
| Unit tests | <runner> | |
| E2E tests | <framework or none> | |
| Lint / format | <ESLint config, Prettier, stylelint> | |
| Package manager | <pnpm/npm + version> | |
| Runtime | Node <version>, pinned in `.nvmrc` + `engines` | |
| Hosting / CI | <…> | |
| Monitoring | <error tracking, logging, analytics> | |
| MCP servers | <name → purpose, pinned version> | |

## Frozen or pinned on purpose

| Package | Pinned at | Why | Unfreeze when |
|---|---|---|---|
| | | | |

## Non-stack decisions

- **Branch model:** <…>
- **Git hooks:** <husky + lint-staged + commitlint>
- **Env management:** <where env and secrets live per environment>
- **Versioning:** <how the app version is set and shown>
