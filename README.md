# angular-pwa-kit

Shared base library, Tailwind CSS v4 + DaisyUI v5 theme layer, Path A GitHub Actions deployment workflow, and sync CLI for standalone zero-backend Angular PWAs.

## How it works

Each Angular PWA lives in its own standalone repository and configures [`angular-pwa-kit.json`](../english-fluency/angular-pwa-kit.json). Instead of publishing and token-authenticating private npm packages, `sync-ng-kit` copies the selected TypeScript/CSS modules cleanly into `src/app/kit/` and tracks SHA-256 checksums (`--check` fails CI/checks if vendored kit files drift).

Because every app compiles its vendored `src/app/kit/` files with its own Angular CLI + Tailwind PostCSS build, there is zero Angular peer-dependency lockstep overhead across repos.

## Included modules (`kit/`)

| File | Purpose |
| --- | --- |
| `theme.css` | Tailwind v4 + DaisyUI v5 (`nord`/`dim` system auto + light/dark presets), calendar cells, SVG chart classes, toast & timer bar styles |
| `theme.service.ts` | Signal-based `ThemeService` (`KIT_THEMES`, `setTheme`, `localStorage` persistence) |
| `app-shell.component.ts` | Sticky navbar shell (`<kit-app-shell>`), router tabs, `<kit-timer-bar>`, `<kit-toast>`, `<kit-confirm-dialog>` |
| `timer.service.ts` + `timer-bar.component.ts` | Countdown timer with Wake Lock, WebAudio chime, visibility sync, and floating controls |
| `toast.service.ts` + `toast.component.ts` | Signal toast notifications with optional undo/action button |
| `confirm-dialog.service.ts` + `confirm-dialog.component.ts` | Promise-based `<dialog>` confirmation modal |
| `idb.ts` | Typed IndexedDB wrapper factory (`createDb`, `requestPersist`) |
| `dates.ts` | DST-safe noon-anchored ISO date helpers and `Intl.DateTimeFormat` builders |
| `ics.ts` | Recurring `.ics` calendar generator and `reminderDue` evaluator |
| `chart-kit.ts` | Responsive SVG chart helpers (`barPath`, `niceScale`, `pointerIn`) |
| `storage-utils.ts` | Blob file `downloadFile` and `copyText` clipboard helper |

## Commands

```powershell
# Run kit unit tests (pure TS executed directly via Node 24)
npm.cmd test

# Check vendored apps for drift
.\bin\sync-ng-kit.cmd --check

# Sync updated kit modules into an app
.\bin\sync-ng-kit.cmd --app english-fluency

# Wire kit + Tailwind PostCSS + Path A workflow into an Angular app
.\bin\new-ng-pwa.cmd my-app --name "My App" --port 4177
```
