# GritFitness Member PWA

Installable member app for GritFitness, built with Vue 3, Vite, Pinia, Tailwind v4 and vite-plugin-pwa. It talks to the existing backend at `https://gritfitness.id/api`.

## Develop

    npm install
    npm run dev        # http://localhost:5173
    npm run build      # dist/ (also writes dist/404.html for SPA deep links)
    npm run preview

Regenerate icons from `public/icons/source.jpg` with `npx pwa-assets-generator`.

## Deploy (GitHub Pages, https://grit.ulfillah.com)

1. Push to a GitHub repo, branch `main`.
2. Repo Settings > Pages > Source: **GitHub Actions**. Custom domain: `grit.ulfillah.com` (`public/CNAME` is already included).
3. DNS: add `CNAME  grit  ->  <github-user>.github.io` at the `ulfillah.com` DNS provider, then tick **Enforce HTTPS**.
4. Each push to `main` runs `.github/workflows/deploy.yml`.

## API notes

- Auth: `POST /request-otp`, `POST /verify-otp` return a Bearer token (about 5 hours).
- Never use a trailing slash in API paths; the server redirects to plain `http://`.
- "No data" is often HTTP 404 `{status, message}`; `api()` maps it to an empty value via `emptyOn404`.
- Active membership / QR: `GET /member/list/:userId` returns `qr_code` as a base64 SVG.
