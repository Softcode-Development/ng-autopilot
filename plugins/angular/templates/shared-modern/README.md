# shared/modern

<!-- guide: created by sync because lint.strictScope lists this folder. Fill the legacy-counterpart column from the repo's legacy shared/ folder; drop rows for kinds the project will not have. -->

The modern half of `shared/`: new code that more than one feature uses. It sits inside `lint.strictScope`, so every autopilot rule is a lint error here.

| Kind | Folder | Legacy counterpart |
|---|---|---|
| Components (composites, dumb UI) | `components/{name}/` | <legacy components folder> |
| Dialogs | `dialogs/{name}/` | <legacy dialogs folder> |
| Services (app-wide singletons) | `services/` | <legacy services folder> |
| API classes for endpoints several features call | `data-access/` | <legacy API / models folder> |
| Pipes, directives | `pipes/`, `directives/` | <legacy pipes and directives folders> |
| Pure helpers | `utils/` | <legacy utils folder> |

- A subfolder is created by the first code that needs it. Code one feature uses stays in that feature; the second feature that needs it moves it here.
- **Modernising a legacy piece:** write it anew here under the same name (`shared/components/{name}` → `shared/modern/components/{name}`). The legacy original stays for its legacy consumers and is deleted with the last of them — never modernised in place.
- Legacy code does not import from here; features and other `shared/modern/` code do.

Rules: [ARCHITECTURE.md § 2](__ROOT__docs/ARCHITECTURE.md), [project rules](__ROOT__.claude/rules/project.md), autopilot architecture rule § Legacy stays legacy.
