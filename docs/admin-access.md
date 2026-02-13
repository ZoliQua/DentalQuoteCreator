# Admin access

## Default bootstrap admin

When the backend starts and there are no users yet, it creates one admin user automatically.

Default values:

- Email: `admin@dentalquote.local`
- Password: `Admin123!`
- Full name: `System Admin`

## How to change admin credentials

Set these variables in `backend/.env` before first start on a fresh database:

- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `ADMIN_FULL_NAME`

Optional session TTL:

- `AUTH_SESSION_TTL_DAYS` (default: `14`)

## Existing database behavior

If at least one user already exists, bootstrap admin creation is skipped.

In that case, change users from the Admin page inside the app (`/admin`) with an admin account.
