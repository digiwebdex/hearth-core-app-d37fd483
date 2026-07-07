# 110 — Environment Configuration Strategy

**Date:** 2026-07-06
**Purpose:** Decide whether `.env` / `backend/.env` should be git-tracked, and lay out a **safe** migration + a durable env strategy for local dev and VPS deployment.
**Type:** Inspection + plan only. **No files were modified, no `git rm` was run, nothing was committed.** All commands below are for you to run **after approval**.

---

## 1. Current state (inspected)

**Tracked env files** (`git ls-files | grep .env`):

| File | Tracked? | Git-ignored? | Committed content | Verdict |
|---|:---:|:---:|---|---|
| **`.env`** (root) | **YES** ⚠️ | **No** | `VITE_API_URL=https://api.travelagencyweb.com/api` (only — **no secret**) | **Should NOT be tracked** |
| `.env.example` (root) | Yes | No | frontend template (`VITE_API_URL`, `VITE_APP_DOMAIN`, `VITE_VPS_IP`) | ✅ keep tracked |
| `.env.production.example` | Yes | No | prod frontend template | ✅ keep tracked |
| `app/.env.example` | Yes | No | Docker/compose template | ✅ keep tracked |
| `backend/.env.example` | Yes | No | backend template (DB/JWT/gateways…) | ✅ keep tracked |
| **`backend/.env`** | **No** (never tracked) | **Yes** | — (doesn't exist) | ✅ correct |

**Ignore rules today:**
- Root `.gitignore` ignores `.env.production`, `.env.local`, `*.local` — **but not bare `.env`.** ← the gap.
- `backend/.gitignore` ignores `.env` + `.env.*` with `!.env.example` — **correct** (hardened in Phase 1).

**History:** root `.env` was committed once (`a2202e0`); it has only ever contained `VITE_API_URL`. `backend/.env` has **no** history. A secret-key scan (`JWT_SECRET`/`DATABASE_URL`/`*PASSWORD`/`*SECRET`/`*_KEY`/`*TOKEN` with a real value) across every committed env file returned **nothing** — the tracked files carry no secrets today.

> Prior related fix: Phase 1 already `git rm --cached`'d `backend/.env.backup` (which *did* contain `JWT_SECRET`/`DATABASE_URL`) and hardened `backend/.gitignore`. This doc closes the remaining gap: the **root `.env`**.

---

## 2. Risks

The tracked root `.env` currently leaks **no secret**, but it is still wrong and carries real risk:

1. **Latent secret leak (the main risk).** `.env` is the natural place a developer puts a real secret (a personal DB URL, an API key). Because `.env` is **tracked and not ignored**, the next `git add .` / `git commit -a` silently **stages and commits that secret** — and once pushed, it's in history forever. Today it's just a URL; tomorrow it's a credential.
2. **Environment drift / broken local dev.** The committed `.env` baked the **production** API URL into the repo, which is exactly why local login failed (the app called `api.travelagencyweb.com` from `localhost`). A tracked env file fights every developer's local needs.
3. **Deploy footgun.** A tracked `.env` can override a server's intended config, or a local edit can be pushed and change the deployed API URL for everyone.
4. **No single source of truth.** Real config lives in two places (the tracked `.env` and each dev's local reality), so they drift.

**Not a risk right now:** no secret rotation or history rewrite is needed *for `.env`* — it never held a secret. (Contrast: the `.env.backup` from Phase 1 *did*, and those secrets still need rotation per [100](100-Audit-Remediation-Phase-1.md)/[103](103-RC1-Release-Checklist.md).)

---

## 3. Recommended Git strategy

**Principle:** commit **only** `*.env.example` templates; **never** commit a real `.env`. Untrack the root `.env` (keeping every developer's local copy), and close the ignore gap.

### 3.1 Target ignore rules
Root `.gitignore` — add:
```
# Real env files — never commit; only *.env.example is tracked
.env
.env.*
!.env.example
!.env.production.example
```
`backend/.gitignore` — already correct (`.env`, `.env.*`, `!.env.example`). `app/.gitignore` — add the same block if `app/.env` is ever created.

### 3.2 Safe migration (run AFTER approval — not run here)

> ⚠️ **The one gotcha:** after `git rm --cached .env` is committed and **pushed**, when another developer **pulls**, git may **delete their local `.env`** (git applies the recorded deletion to a working file that still matches the old committed version). So every dev must back it up first. This is the step that protects "don't break existing developers' setups."

**Person doing the migration:**
```bash
# 1. Back up (safety)
cp .env .env.backup.local           # local-only; already ignored by the new rules

# 2. Stop tracking the real .env (keeps the working file)
git rm --cached .env

# 3. Add the ignore rules from §3.1 to .gitignore, then commit both together
git add .gitignore
git commit -m "chore: stop tracking root .env; ignore real env files (keep .env.example)"

# 4. Verify: .env is now ignored + untracked, working copy intact
git check-ignore .env               # -> .env  (ignored)
git status --porcelain .env         # -> (empty)  no longer tracked
cat .env                            # -> still there locally
```

**Every other developer, on the pull that includes this commit:**
```bash
cp .env .env.keep 2>/dev/null || true   # back up BEFORE pulling
git pull
[ -f .env ] || cp .env.keep .env         # restore if the pull removed it
# (or simply: cp .env.example .env  and re-fill)
```
Announce this in the team channel so no one is surprised by a missing `.env`.

### 3.3 Why no history purge / rotation for `.env`
The only value ever committed to `.env` is the public `VITE_API_URL`. No secret was exposed, so **no BFG/filter-repo and no rotation are required for `.env`**. (The `.env.backup` secrets from Phase 1 are a separate, still-open rotation item.)

### 3.4 Note on the current working tree
Your local `.env` currently reads `VITE_API_URL=http://localhost:4000/api` (the local-dev fix). Once §3.2 runs, that value stays **local and untracked** — the drift disappears and the committed repo no longer carries any API URL.

---

## 4. `.env.example` structure (the tracked templates)

Keep four templates, one per surface. They must contain **keys with placeholder/empty values only — never real secrets**.

| File | Surface | Contains | Example values |
|---|---|---|---|
| **`.env.example`** (root) | Frontend build (Vite) | `VITE_API_URL`, `VITE_APP_DOMAIN`, `VITE_VPS_IP` | dev/prod URLs (public) |
| **`.env.production.example`** (root) | Frontend prod build | `VITE_API_URL` (prod) | `https://api.<domain>/api` |
| **`backend/.env.example`** | Backend API | `DATABASE_URL`, `JWT_SECRET`, `PORT`, `NODE_ENV`, `CORS_ORIGIN`, SMTP/SMS/WhatsApp/gateway keys, `CRON_SECRET`, storage paths, `SEED_*`, advanced flags | all empty or `CHANGE_ME`/`change-this-…` |
| **`app/.env.example`** | Docker/Compose | `POSTGRES_*`, `JWT_SECRET`, `VITE_API_URL`, domains | empty/`:?`-required in compose |

**Rules for the templates:** every real config key present (so nothing is undocumented), secrets blank or obviously-fake, a one-line comment on non-obvious keys, and they stay in sync with what the code actually reads.

---

## 5. Local development workflow

```bash
# Frontend
cp .env.example .env                 # then set VITE_API_URL=http://localhost:4000/api  (+ VITE_APP_DOMAIN=localhost for portal)

# Backend
cp backend/.env.example backend/.env # then set DATABASE_URL, JWT_SECRET, PORT=4000, NODE_ENV=development
cd backend && npm run setup && npm run dev
npm run dev                          # (root) frontend on :8080
```
- Each developer's `.env` / `backend/.env` is **local, untracked, never committed**.
- Update the matching `*.env.example` (with placeholder values) whenever you add a new env var the code reads — that's the shared contract.
- See [109-Local-Acceptance-Test §0](109-Local-Acceptance-Test.md) for the full bring-up.

---

## 6. VPS deployment workflow

Production env must come from the **server**, not from a tracked file:

- **PM2 path** (`scripts/vps-pm2-deploy.sh`): `backend/.env` and root `.env.production` live **only on the VPS** (git-ignored). The deploy script already preserves a VPS-local `.env.production` across pulls and warns if it's missing. The frontend build reads `.env.production` (`VITE_API_URL` = the real API domain).
- **Docker/Compose path** (`app/docker-compose.yml`): env comes from a server-side `.env` consumed by compose (`--env-file .env`); `JWT_SECRET`/`POSTGRES_PASSWORD` are `:?`-required so a missing secret fails the deploy loudly; `VITE_API_URL` is passed as a frontend **build arg**.
- **Never** deploy by committing a prod `.env`. Provision it once on the box (or via the platform's secret store) from `*.env.production.example`.
- Pre-deploy env verification is in [103-RC1-Release-Checklist §1](103-RC1-Release-Checklist.md) (real `VITE_API_URL`, `RATE_LIMIT_DISABLED` unset, gateway `SANDBOX=false`, etc.).

---

## 7. Production secret management

- **Storage:** secrets live only on the VPS `backend/.env` (chmod 600) or the platform secret store (Coolify/Traefik env, GitHub Actions secrets for CI) — **never** in git, never in `*.example`.
- **Rotation (open item):** rotate every secret that was in the historical `backend/.env.backup` — at minimum `JWT_SECRET` (rotating it forces re-login) and `DATABASE_URL`, plus gateway/SMTP creds ([100 H1](100-Audit-Remediation-Phase-1.md), [103 §11](103-RC1-Release-Checklist.md)). This is unrelated to `.env` (which had none) but is still outstanding.
- **Required-and-strong:** `JWT_SECRET` ≥ 32 chars (the app `process.exit(1)`s in prod otherwise); `CRON_SECRET`, gateway keys, SMTP creds set for the features in use.
- **Hygiene going forward:** with §3 applied, a real secret in a local `.env` can no longer be accidentally committed. Add a pre-commit secret scan (e.g. gitleaks) as defense-in-depth, and keep `.env*` (except examples) in `.gitignore` in every package (`/`, `backend/`, `app/`).
- **Lockfiles:** note the pending `npm install`/`bun install` reconcile from [106](106-Codebase-Cleanup.md) (both `package-lock.json` and `bun.lock` exist) — unrelated to secrets but part of a clean deploy.

---

## Summary decision

| File | Should it be tracked? | Action |
|---|---|---|
| `.env` (root) | **No** | `git rm --cached .env` + add to `.gitignore` (§3.2). No secret was exposed → no rotation/history-purge needed. |
| `backend/.env` | **No** | Already correct — ignored + never tracked. No action. |
| `*.env.example` (×4) | **Yes** | Keep tracked; keep placeholders-only. |

*Inspection + plan only. Nothing in the repository was modified or committed. Awaiting approval to run §3.2.*
