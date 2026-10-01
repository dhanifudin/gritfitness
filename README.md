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

## Weekly class timetable

The API only lists **today's** classes, and schedule rows are created about a day ahead, so the week view (`/classes`) combines two sources:

- **Real**: today's rows from `GET /jadwal-kelas` (badge "Terjadwal", opens the class detail).
- **Predicted**: the gym's recurring weekly timetable, inferred from past schedules and bundled as `src/data/timetable.json` (badge "Perkiraan").

The API lets us read history by id (`GET /jadwal-kelas/detail/:id`), so the timetable can be rebuilt with:

    GRIT_TOKEN=<member bearer token> npm run gen:timetable

A slot (weekday + start time + class) is kept when it appeared in at least 2 of the last 4 complete Mon–Sun weeks. The script prints a backtest against the newest complete week (last run: precision 0.87, recall 0.96). Regenerate whenever the gym changes its timetable. A proper `GET /jadwal-kelas?from=&to=` endpoint (and publishing schedules further ahead) on the backend would make the predictions unnecessary.

## Class information

Schedule cards open a "Tentang kelas" sheet (and `/classes/:id` shows a "Tentang kelas" card) with what each class is. The text comes from the public class pages at https://gritfitness.id/kelas (no login needed), bundled as `src/data/classInfo.json`. The id in each card's link on the site is the class package id (`id_paket_kelas`), which schedule rows and timetable slots carry, so the app joins on it.

    npm run gen:classinfo

Refreshes the file from the site (it refuses to overwrite it if the page layout changed). Four classes currently have no description on the site and show only their category text.
