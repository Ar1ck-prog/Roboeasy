# RoboEasy AI

A robotics course from scratch for LEGO SPIKE Prime: short lessons with a robot simulator and Blockly, autochecks, an AI mentor that gives hints (never solutions), a path map, streaks, achievements, daily quests, practice games (robot maze, program puzzles, term pairs, blitz), a robot buddy you upgrade in the garage with coins earned by learning, and a glossary with resources. Self-paced: no classes or teachers. Plus the original tools: describe a task in plain words and get a `.llsp3` program for the SPIKE App 3, and an FLL run-strategy helper. UI in Russian, Kazakh and English.

## Run

```bash
npm install
cp .env.example .env.local   # add GEMINI_API_KEY
npm run dev                  # http://localhost:3000 → /ru, /kk or /en
```

Accounts and sync are optional (without them progress stays in the browser). Locally they run on Supabase in Docker:

```bash
npm run db:start             # prints the API URL and keys; ports 563xx
# put NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY into .env.local
npm run db:reset             # re-apply supabase/migrations
```

Sign-in emails land in the local Mailpit: http://127.0.0.1:56324.

| Command | What it does |
|---|---|
| `npm test` | vitest: DSL validation, both compilers, .llsp3 packing, FLL geometry and planning, season files and migration, editor model, perspective correction, Python snapshots |
| `npm run e2e` | Playwright (desktop and tablet): new learner journey with a fixed clock, and games → coins → a garage purchase |
| `npm run db:test` | database tests against the local Supabase: XP rules equal the app's, idempotent sync, row-level security, account deletion |
| `npm run typecheck` | TypeScript strict |
| `npm run build` | production build |
| `npm run reference` | compares our blocks with SPIKE App exports in `reference/` (see `reference/README.md`) |

## Deploy (Render)

`render.yaml` is a Render Blueprint: in the Render dashboard choose **New → Blueprint**, pick this repository and enter `GEMINI_API_KEY` when asked (`CERT_SECRET` is generated). Render builds with `npm ci && npm run build` and runs `npm run start` on Node 22; every push to `main` redeploys. Without hosted Supabase variables the site runs local-only (progress in the browser). The free plan sleeps when idle, so the first visit after a pause takes up to a minute.

## Learning platform

- Content is data: `content/learn/course.json` (8 tracks, 37 units, 123 lessons; `ready` ones have a file) and `content/learn/lessons/*.json`, validated by `lib/learn/schema.ts` (zod). Tests run every reference solution through the simulator and its checks. Weekly challenges: `content/learn/challenges.json`.
- `lib/sim/` — the 2D robot simulator (fixed 10 ms step, mm, sensors); `lib/learn/checks.ts` — autochecks (zone, points, collisions, sensors, blocks…).
- `lib/learn/state.ts` + `store.ts` — the learner's append-only event log in localStorage; XP (`xp.ts`), unlocking and spaced review (`progress.ts`), streaks in the learner's time zone with freezes (`streak.ts`), achievements, cosmetics, placement test, certificates (signed codes + PDF), analytics and A/B flags (`lib/flags.ts`) are all computed from it.
- `lib/learn/cloud.ts` — optional Supabase client loaded on demand: email + password accounts (no confirmation email; turn off "Confirm email" in the Supabase project), two-way sync of the same event log (server keyed by event id, so replays change nothing). Schema and row-level security: `supabase/migrations/`.
- Routes: `/path` (home, onboarding), `/learn`, `/learn/[track]`, `/learn/[track]/[lesson]`, `/learn/placement`, `/review`, `/path/challenge`, `/play` (games: `/play/maze`, `/play/puzzle`, `/play/memory`, `/play/blitz`), `/garage`, `/library`, `/profile`, `/cert/[code]`, `/privacy`, `/parents`, `/sandbox` (AI studio), `/compete` (FLL), `/compete/simulator` (FLL field simulator: BIOGLOW field with the team's mat picture shared with the FLL coach, runs from missions or blocks, a 2:30 match and the season score sheet), `/ai` (the generator's landing), `/admin` (hidden in production).
- Privacy and child safety: `docs/privacy.md` (draft for legal review).

## RoboEasy 2.0

What was added (full list in `CHANGELOG.md`):

| Where | What |
| --- | --- |
| `/[lang]/sandbox` | Generator with arcs, circles, variables and the program's own blocks |
| `/[lang]/sandbox/draw` | Draw a route; the code turns it into commands |
| `/[lang]/sandbox/video` | Video debugging with the mentor |
| `/[lang]/learn/ai-basics` | "AI from zero" section |
| `/[lang]/teacher` | Teacher's room: classes, before-and-after report, Excel and CSV |
| `/[lang]/class` | Learners join a class with a code, a nickname and a PIN |
| `/[lang]/admin/ai` | Today's AI usage (admins only) |

### Environment variables

Server secrets are never committed. Set them in `.env.local` or in the Render dashboard.

| Variable | Needed | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` | yes | Key of the site |
| `GEMINI_MODEL_MAIN` | yes | Model for complex requests and video |
| `GEMINI_MODEL_LIGHT` | no | Model for simple requests (falls back to the main one) |
| `GEMINI_MODEL_FALLBACKS` | no | Comma-separated models to try when others are out of quota |
| `GEMINI_MENTOR_API_KEY` | no | Separate key for the mentor in production |
| `GEMINI_API_KEY_DEV` | for eval | Demo key; used instead of the others outside production |
| `SUPABASE_SERVICE_ROLE_KEY` | for the AI layer | Cache, shared limits, counters, failure log |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | for accounts | Accounts, sync, classes |
| `CERT_SECRET` | in production | Signs certificates and hashes rate-limit keys |

Classes also need **Authentication → Providers → Allow anonymous sign-ins** turned on in Supabase, and the migrations in `supabase/migrations` applied.

### Generator eval

```bash
npm run eval:generator -- --limit 10
```

It uses only `GEMINI_API_KEY_DEV`, refuses to run without it or without `--limit`, stops at the first quota error and never spends more than 15 requests. It prints the success rate per category. Unit and browser tests never reach Gemini.

## Key principle

The AI only writes commands of a small DSL. Valid word blocks and Python are produced by our deterministic compilers; the AI never writes Scratch JSON. In the FLL helper the AI decides the strategy, while distances and angles are computed from the field coordinates by our code.

## Structure

- `lib/dsl/types.ts` — DSL commands (`Step`), robot profile (`RobotProfile`: ports, wheel/track in mm, calibration factors, attachments).
- `lib/dsl/schema.ts` — zod validation of everything untrusted (AI output, client data, robot profile) and the compact JSON Schema sent to Gemini as `responseJsonSchema`. Structure is strict (one retry with the error text), numbers are clamped.
- `lib/dsl/compile-blocks.ts` — DSL → Scratch `project.json` with SPIKE App 3 opcodes. `turn` uses the hub gyro (reset yaw → spin → wait until |yaw| > angle → stop, in steps of ≤ 90°).
- `lib/dsl/compile-python.ts` — DSL → SPIKE 3 MicroPython; checks for free Python (`runloop.run(main())`, allowed imports, no SPIKE 2 API).
- `lib/spike/llsp3.ts` — packs `.llsp3` exactly like the SPIKE App; `lib/spike/prompts.ts` — system prompts.
- `lib/spike/ble-protocol.ts`, `lib/spike/ble.ts`, `components/robot-link.tsx` — direct link to a SPIKE Prime hub over Web Bluetooth (LEGO's published SPIKE App 3 protocol): upload to a slot, start, stop, console, sensors. Chrome/Edge on desktop and Android, HTTPS only; needs the hub on SPIKE App 3 firmware (not Pybricks). Tests run against a simulated hub.
- `lib/gemini.ts` — Gemini client: JSON schema, model fallbacks, timeouts.
- `lib/learn/site-mentor.ts`, `app/api/mentor`, `components/site-mentor.tsx` — the mentor chat on every page. Its knowledge is built from the course, glossary, shop and coin rules, never from lesson solutions; messages are not stored.
- `app/api/generate` — modes `blocks`, `python` (both DSL) and `python-free` (the AI writes Python).
- `lib/fll/*`, `data/seasons/*.json`, `app/api/fll/plan`, `app/[lang]/compete` — FLL helper: season schema (`season.ts`), shape geometry (`geometry.ts`), route geometry (`path.ts`), runs (`run.ts`), calibration, AI planning with a deterministic fallback.
- `app/[lang]/compete/editor` — field editor (missions, launch areas, forbidden zones; undo/redo, JSON import/export, draft autosave in IndexedDB).
- `lib/compilers/index.ts` — code generators by robot platform (`spike` only for now; other platforms can still plan routes).
- `app/[lang]/` — pages; `lib/i18n/` — dictionaries (`ru` defines the shape); `proxy.ts` — language redirect; old URLs (`/workspace`, `/fll`) redirect in `next.config.mjs`.

## FLL season data

One schema for every season (`lib/fll/season.ts`, `schemaVersion: 2`; v1 files are migrated on load). `data/seasons/index.json` lists the seasons; the one with `status: "current"` is selected by default.

`bioglow-2026.json` (current) and `unearthed-2025.json` (archive) are skeletons: metadata and the mat size only, marked TODO. Missions, launch areas and forbidden zones are entered from the official Robot Game Rulebook in the field editor (`/ru/compete/editor`), exported as JSON and saved over the season file. Coordinates are millimetres from the bottom-left corner of the mat; angles are degrees, 0 = right, counterclockwise. Mission outlines and action zones are stored in the model's own frame, so rotating a model rotates them too.

The official field artwork belongs to FIRST/LEGO and is not in this repository. Teams can use their own photo, scan or PDF of the mat as a background: it is stored only in the browser (IndexedDB) and straightened by marking the four mat corners.

## Notes

- The rate limiter is in-memory (per server instance).
- Robot profile and history are stored in the browser's localStorage (profile schema is versioned; v1 is migrated).
- Production needs `CERT_SECRET` (certificate signatures); see `.env.example`.
- LEGO® and SPIKE™ are trademarks of the LEGO Group, which does not sponsor or endorse this project.

## 3D-симулятор FLL в RoboEasy

Исходный код симулятора находится в `fll-simulator/`; в нём сохранены движок, редактор, конструктор, просмотр `.io` и экспорт. Маршрут `/{ru|kk|en}/compete/simulator` показывает 3D-приложение по `/fll-sim/index.html` (прежний 2D-симулятор RoboEasy убран). Тема, шрифт Rubik и иконки вместо эмодзи — в `fll-simulator/src/roboeasy/` (`theme.css`, `mobile.css`, `icons.js`); тема по сайту и сенсорное управление — в `fll-simulator/public/roboeasy/`.

Установите зависимости RoboEasy командой `npm ci`. Выполните `npm run fll:build`, затем `npm run dev`. Откройте http://localhost:3000/ru/compete/simulator. Собранный симулятор хранится в репозитории (`public/fll-sim`), поэтому `npm run build` и деплой его не пересобирают. После правок в `fll-simulator/` выполните `npm run fll:build` и закоммитьте изменения в `public/fll-sim`: команда устанавливает зафиксированные зависимости, собирает симулятор и заменяет старые файлы в `public/fll-sim/assets`. Python и физика запускаются в браузере; для паузы Python важны заголовки из `next.config.mjs`.

Просмотр `.io` пока не превращает импортированную модель в редактируемого или движущегося робота. Геометрия деталей ограничена включённой выборкой LDraw; неизвестные детали обозначены рамками. Подробности и лицензии — в `fll-simulator/README.md`. Интерфейс 3D-симулятора остаётся русскоязычным и внутри страниц на казахском и английском языках.
