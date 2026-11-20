# MentorLagbe Server

Express API for MentorLagbe (Smart Tuition & Mentorship Platform).

## Run locally
1. `npm install`
2. Copy `.env.example` to `.env` and fill in the values
3. `npm run dev`

Health check: `GET /health`

## Deploy on Vercel
1. Import this repo in Vercel (framework preset: Other)
2. Add the environment variables from `.env.example`
3. Deploy. `vercel.json` routes every request to `index.js`

## Seed demo data
Add the `SEED_*` values from `.env.example` to your `.env`, then run:

    npm run seed

This creates the admin, 4 tutors and 2 students (through BetterAuth), 12 approved tuitions
(plus 2 pending and 1 rejected), and sample applications.

## Public API
- `GET /api/tuitions?search=&subject=&classLevel=&mode=&page=&limit=`
- `GET /api/tuitions/latest`
- `GET /api/tuitions/filters`
- `GET /api/tuitions/:id`
- `GET /api/stats`
