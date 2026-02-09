# Szamlazz.hu Proxy Server

Minimal Express bridge for Szamlazz.hu Agent XML calls.

## Env
Create `server/.env`:

- `SZAMLAZZ_AGENT_KEY=`
- `INVOICE_MODE=preview` (`preview` or `live`)
- `PORT=5178`

## Endpoints
- `POST /api/szamlazz/preview-invoice`
- `POST /api/szamlazz/create-invoice`

