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

## Student and upload API (JWT required)
- `POST /api/applications` - student applies (no duplicates)
- `GET /api/applications/my` - student's applications
- `GET /api/applications/check/:tuitionId` - has the student already applied?
- `DELETE /api/applications/:id` - cancel a pending application
- `POST /api/upload` - upload an image to ImgBB (key stays on the server)

## Tutor API (JWT + tutor role)
- `GET /api/tutor/stats`
- `POST /api/tutor/tuitions` - post a tuition (free plan: max 2)
- `GET /api/tutor/tuitions`, `GET|PUT|DELETE /api/tutor/tuitions/:id`
- `PATCH /api/tutor/tuitions/:id/toggle` - Active / Closed
- `GET /api/tutor/applicants`, `PATCH /api/tutor/applicants/:id` - accept or reject

## Admin API (JWT + admin role)
- `GET /api/admin/stats`
- `GET /api/admin/users`, `PATCH /api/admin/users/:id/role`
- `GET /api/admin/tuitions`, `PATCH /api/admin/tuitions/:id/status`
- `GET /api/admin/transactions`
