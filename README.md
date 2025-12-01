# Auth QA Toolkit (Unit + Integration + E2E)

A minimal template for validating authentication across layers: Java unit/integration plus Playwright end-to-end coverage. Swap the sample auth domain with your own code.

## Layout
- `service/` — Java module with auth sample and tests (JUnit 5, AssertJ, Mockito, Testcontainers). Base package: `com.qatoolkit.auth`.
- `e2e/` — Playwright auth framework + template specs (TypeScript).

## Java unit + integration
```bash
cd service
mvn test                   # runs unit + integration (Testcontainers will pull Postgres)
```
Key pieces:
- `AuthService` with `UserRepository` and `PasswordHasher` for unit tests.
- `AuthServiceTest` uses Mockito.
- `JdbcUserRepositoryIntegrationTest` uses Testcontainers + Postgres to show a real DB path.

## E2E with Playwright
```bash
cd e2e
npm install
npx playwright install --with-deps   # once per machine
E2E_BASE_URL=https://your-app.test npm test
```
What you get:
- Multi-browser projects (Chromium/Firefox/WebKit) in `playwright.config.ts` using `E2E_BASE_URL` (default `http://localhost:3000`).
- Reusable auth helpers in `src/authFramework.ts` (login, invalid login, logout, token checks).
- Configurable selectors and credentials via `auth.config.json` (copy from `auth.config.example.json`) or env vars.
- Template spec in `tests/auth.spec.ts` that calls the framework; adjust or extend as needed.
- Generic, config-driven web automation helpers in `src/webFramework.ts` for smoke checks or end-to-end journeys defined in `web.config.json`.

### Env knobs
- `E2E_USER_EMAIL` / `E2E_USER_PASSWORD` — credentials for happy path.
- `E2E_PROTECTED_PATH` — route to assert redirect handling (default `/dashboard`).

### Config file (optional)
- Copy `e2e/auth.config.example.json` to `e2e/auth.config.json` and tweak selectors, messages, token names, and endpoints without touching code.
- Copy `e2e/web.config.example.json` to `e2e/web.config.json` to define scenario steps like `goto`, `click`, `fill-form`, `wait-for-response`, and `expect-text`. The template includes a `smoke-home` journey you can replace with your app’s selectors.

### Using the auth flows
1) Set `E2E_BASE_URL`, `E2E_USER_EMAIL`, and `E2E_USER_PASSWORD` for your app.  
2) Copy and edit `e2e/auth.config.example.json` to match your login selectors, protected path, and error messages.  
3) Run `npm test` in `e2e/` to execute `tests/auth.spec.ts`, which calls the reusable helpers (happy path, invalid login, logout).

### Using the generic web scenarios
1) Copy `e2e/web.config.example.json` to `e2e/web.config.json`.  
2) Define journeys under `scenarios`, each as an ordered list of steps. Supported actions: `goto`, `click`, `fill`, `fill-form`, `wait-for-response`, `wait-for-requests`, `expect-text`, `expect-visible`, `expect-url-contains`, `expect-attribute`, `expect-count`, `upload-file`, `expect-toast`.  
3) In `e2e/tests/web.smoke.spec.ts`, enable or rename the scenario you want (default is `smoke-home`); tests will skip if the scenario is missing.  
4) Run `npm test` to execute the config-driven journey or use `webSuite().create(page)` for imperative flows.

## How to extend
- Add more Java tests under `src/test/java` and keep integration tests isolated with Testcontainers/WireMock.
- For E2E, add more specs in `e2e/tests/`, and use API helpers/fixtures to seed state fast.
- Wire CI to run `mvn test` and `npm test` in parallel; publish Playwright traces/reports as artifacts.

## Notes
- Spring JDBC is included to keep the repository concrete; swap for your data layer as needed.
- Keep selectors stable with `data-cy` attributes to avoid brittle tests.

## Git quickstart
- `git init` at repo root.
- Copy `e2e/auth.config.example.json` to `e2e/auth.config.json` (kept out of git for secrets).
- Add remote and commit: `git add . && git commit -m "chore: bootstrap auth qa toolkit"`.
