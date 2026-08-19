# SyncSpace Admin

Admin dashboard for **SyncSpace** — bookable meeting rooms by the hour. Built on React + Vite + styled-components + React Query + Supabase.

## Overview

| Area | Stack |
| --- | --- |
| UI | React 18, Vite, styled-components |
| Data | @tanstack/react-query, Supabase (Postgres + Storage + Auth) |
| Routing | react-router-dom (hash router) |
| Charts | recharts |
| Forms | react-hook-form, react-hot-toast |

## Getting started

```bash
npm install
cp .env.local.example .env.local   # or reuse the existing .env.local
npm run dev
```

The client reads `SUPABASE_URL` and `SUPABASE_KEY` from `.env.local` (see `src/services/supabase.js`). `npm run build` + `npm run deploy` publish to GitHub Pages via `gh-pages`.

## What this app does

- **Dashboard** — last 7/30/90 days of sales, occupancy rate, today's arrivals/leavings, booking-length breakdown.
- **Bookings** — every room booking with guest, time window, status (`booked` / `in-use` / `completed` / `cancelled` / `no-show`) and amount. Mark a booking in use, complete it, or delete it.
- **Rooms** — the meeting rooms with hourly price, capacity, discount and photo (Supabase Storage, `room-images` bucket).
- **Users** — admin users (auth.users via `admins` table).
- **Settings** — opening hours, min/max booking duration, booking buffer, and the contact-form recipient email used by the customer site.

## Design system

- **Palette**: cool slate neutrals (`--color-grey-*`); status colors double as the accent palette — signal green (available/completed), amber (booked soon), soft coral (in use / no-show).
- **Type**: Space Grotesk for headings and figures, Inter for body.
- **Icons**: lucide-react.

## Database

Tables used: `rooms`, `bookings`, `guests`, `admins`, `room_images`, `settings`. Bookings are hour-based (`startTime` / `endTime` / `numHours`); overlapping rows are prevented by the `no_overlapping_bookings` exclusion constraint (except `cancelled` / `no-show`).

The commented-out `Uploader` in `src/ui/Sidebar.jsx` can reseed sample data.