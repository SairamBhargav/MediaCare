# Architecture

## 1. Shape

One Expo app repository. No monorepo, no backend, no desktop packages until a real near-term need exists.

```
┌──────────────────────────────────────────────────────────────┐
│ src/app/            Routes only (Expo Router). Thin files.    │
│ src/screens/        Screen bodies + their private components  │
│ src/components/     Shared accessible UI primitives           │
├──────────────────────────────────────────────────────────────┤
│ src/features/*      Use cases: scan, review, export (Phase 2+)│
├──────────────────────────────────────────────────────────────┤
│ src/domain/         Pure rules: selection, bytes, grouping,   │
│                     keeper choice, storage accounting         │
├──────────────────────────────────────────────────────────────┤
│ src/services/       Adapters: media, analysis, exports, jobs  │
│ src/db/             SQLite schema, migrations, repositories   │
│ src/platform/       Capability resolution, native boundaries  │
└──────────────────────────────────────────────────────────────┘
 src/theme/  tokens      src/state/  small UI stores     src/demo/  sample data
```

Dependency direction is downward only. Screens never call SQL, MediaLibrary, hashing or deletion directly; they call a use case. Domain code imports nothing from React Native or Expo, so it is unit-testable in Node.

### Folder conventions (current)

| Folder                     | Holds                                                                                                                                                                  | Rule                                                          |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `src/app/`                 | Route files and `_layout.tsx`                                                                                                                                          | Only routes. Each route renders a screen from `src/screens/`  |
| `src/screens/<name>/`      | Screen body and components used only there                                                                                                                             | Promote to `components/` when a second screen needs it        |
| `src/components/`          | `AppText`, `Button`, `IconButton`, `Icon`, `PressableScale`, `MediaTile`, `SelectionBadge`, `StatusPill`, `SectionHeader`, `Surface`, `EmptyState`, `Screen`, `TabBar` | kebab-case files, one named export each, styles at the bottom |
| `src/theme/`               | `colors`, `tokens` (spacing/type/radius/shadow), `motion`, `contrast`                                                                                                  | The only place literal colors and sizes may live              |
| `src/domain/`              | Pure functions + colocated `*.test.ts`                                                                                                                                 | No platform imports                                           |
| `src/state/`               | Zustand stores (preferences today)                                                                                                                                     | No media bytes, no catalog                                    |
| `src/demo/`                | Synthetic sample library                                                                                                                                               | Every sample value is labelled in UI                          |
| `src/hooks/`, `src/utils/` | Small shared hooks and helpers                                                                                                                                         | —                                                             |

The prompt's suggested `src/features/` is adopted when the first real use case lands (Phase 2); creating empty folders now would be speculative. Deviation recorded here deliberately.

## 2. Core interfaces (introduced in Phase 2–3)

Capability flags describe behavior, not OS: `canReadOriginal`, `canCompareCompoundResources`, `canDeleteAsset`, `canRecoverInApp` (always false on iOS), `needsNetwork`.

```ts
interface MediaSourceAdapter {
  capabilities(): SourceCapabilities;
  permission(): Promise<PermissionState>; // full | limited | denied | undetermined
  page(query: PageQuery): Promise<AssetSummary[]>; // paginated, never the whole library
  resolve(id: AssetId): Promise<AssetDetail | null>; // re-resolve; URIs may expire
  observe(cb: (change: SourceChange) => void): Unsubscribe;
}
interface OriginalResourceResolver {
  open(id): Promise<ResourceHandle | Unavailable>;
}
interface FingerprintEngine {
  sha256(handle): Promise<Fingerprint>;
  perceptual(handle): Promise<Fingerprint>;
}
interface QualityAnalyzer {
  analyze(handle): Promise<Finding[]>;
}
interface Exporter {
  run(recipe: EditRecipe, target: ExportTarget): Promise<VerifiedDerivative>;
}
interface JobRunner {
  start(job): JobId;
  pause(id);
  cancel(id);
  resume(id);
  events(id): Stream<JobEvent>;
}
interface CleanupPlanner {
  plan(groups, selection): ActionPlan;
} // pure; shows scope before anything happens
interface CleanupExecutor {
  execute(plan: ActionPlan): Promise<ActionResult>;
} // revalidates, then calls the OS
```

## 3. Processing flow (photo cleanup, Phase 3)

```
permission ─▶ index (page through Query) ─▶ catalog rows (SQLite)
                     │ checkpoint every N items; resumable
                     ▼
   size buckets ─▶ resolve original (S1) ─▶ streaming SHA-256 (native, off JS thread)
                     ▼
            exact groups ─▶ keeper suggestion (explainable) ─▶ review UI
                     ▼
     ActionPlan (exact ids, bytes, keeper, warnings) ─▶ user confirms in app
                     ▼
     revalidate (exists, version, bytes, keeper intact) ─▶ OS delete (system dialog)
                     ▼
     ActionResult per item (removed / cancelled / failed / already gone) ─▶ Activity
```

Heavy work never runs on the UI thread and is not assumed to be parallel just because it is `async`. Hashing and pixel work go native (or a worker runtime) once spikes S1/S2 decide the path.

## 4. Data ownership

| Data                                                                       | Owner                                                                         | Notes                                                      |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Media bytes                                                                | iOS Photos                                                                    | Never copied wholesale; temp files are bounded and cleaned |
| Catalog (assets, resources, fingerprints, findings, groups, jobs, actions) | SQLite (`src/db`)                                                             | Source of truth for app knowledge; see DATA_MODEL.md       |
| UI state (selection mode, sheet state)                                     | React state / Zustand                                                         | Ephemeral                                                  |
| Preferences                                                                | Zustand, persisted to `expo-sqlite/kv-store` (synchronous, validated on read) | No media content in preferences                            |
| Derivatives                                                                | Photos (new asset) or app temp dir until saved                                | Lineage row links source and output                        |

## 5. Native escape hatch (Phase 3)

- Continuous Native Generation: `ios/` and `android/` are **generated and git-ignored**. Native config goes in `app.json` / config plugins; native code goes in a local Expo module (`modules/media-native/`, Swift). Nobody hand-edits generated projects (ADR-0004).
- Expo Go stays usable for the sample/demo surface: native-only modules are imported only from files that are loaded after a capability check (`src/platform/`), never at the top of shared modules. If Expo Go support must end, that is an explicit, announced decision.
- Builds happen on EAS (`eas build --profile development --platform ios`). Debugging relies on EAS build logs, device logs and in-app diagnostics; remote Mac access is a fallback for hard native issues only.

## 6. Optional cloud (Phase 5+, only if chosen)

Python/FastAPI workers, private object storage with expiring URLs, durable queue, per-tenant auth, quotas, short retention, idempotent jobs. Introduced only for a specific enhancement whose local option is inadequate, with explicit consent per upload. Provider secrets live on the server, never in `EXPO_PUBLIC_*`.
