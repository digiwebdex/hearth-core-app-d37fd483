# Environment Variables

Single source of truth: `/srv/travelagencyweb/app/.env` (used by `docker compose`). Coolify also has its own UI env editor — keep both in sync if you use Coolify resources.

## Required
| Name | Where | Example |
|---|---|---|
| `POSTGRES_DB` | compose | `travelagencyweb_db` |
| `POSTGRES_USER` | compose | `travelagencyweb_user` |
| `POSTGRES_PASSWORD` | compose, api | strong random |
| `JWT_SECRET` | api | 64-char random (min 32 chars; boot fails in production if missing/short) |
| `ALLOW_DEV_JWT` | api (dev) | `true` to allow dev fallback when `JWT_SECRET` unset locally |
| `CORS_ORIGIN` | api | `https://travelagencyweb.com,https://www.travelagencyweb.com,https://app.travelagencyweb.com,https://portal.travelagencyweb.com` |
| `VITE_API_URL` | frontend build-arg | `https://api.travelagencyweb.com` |

## Optional but recommended
| Name | Purpose |
|---|---|
| `CRON_SECRET` | Protects `/api/cron/*` |
| `SMTP_*` | Outbound email (notifications, magic links) |
| `ADMIN_NOTIFICATION_EMAIL` | Demo/contact form alerts |
| `PUBLIC_UPLOAD_URL` | Absolute URL prefix for uploaded files |
| `FRONTEND_URL`, `API_BASE_URL`, `PORTAL_URL` | Used inside emails and payment callbacks |

## Payment gateways (only if used)
- `SSLCOMMERZ_STORE_ID`, `SSLCOMMERZ_STORE_PASSWORD`, `SSLCOMMERZ_SANDBOX`
- `BKASH_APP_KEY`, `BKASH_APP_SECRET`, `BKASH_USERNAME`, `BKASH_PASSWORD`, `BKASH_SANDBOX`

## Seed (development / controlled production re-seed)
- `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_DEMO_EMAIL`, `SEED_DEMO_PASSWORD`
- `ALLOW_SEED_PASSWORD_RESET=true` — allow seed script to reset passwords in production

## SMS / WhatsApp (only if used)
- `SMS_PROVIDER` — `bulksmsbd` | `twilio` | `console`
- `SMS_ENABLED`, `SMS_API_KEY`, `SMS_SENDER_ID`, `SMS_BASE_URL` (default `http://bulksmsbd.net/api`)
- `TRIAL_EXPIRY_SMS_LANG` — `bn` or `en` for trial-expired SMS text
- BulkSMSBD balance check: `GET /api/sms/balance` (super admin); uses `getBalanceApi` endpoint
- `WHATSAPP_PROVIDER`, `META_WHATSAPP_TOKEN`, `META_WHATSAPP_PHONE_ID`

**Never commit `.env`.** `backend/.gitignore` and `.dockerignore` already exclude it.
