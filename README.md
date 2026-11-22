# MentorLagbe Server

Express + MongoDB REST API for **MentorLagbe**, a role-based tuition and mentorship platform
(students, tutors and admins). It verifies JWT tokens, enforces roles, saves Stripe payments and uploads images to ImgBB.

## Live Links
- **Server API:** https://mentorlaaagbe-server.vercel.app
- **Live site:** https://mentorlaaagbe.vercel.app
- **Server repository:** https://github.com/<your-username>/mentorlagbe-server
- **Client repository:** https://github.com/<your-username>/mentorlagbe-client

## Admin Credentials
- **Email:** mentorlagbe@gmail.com
- **Password:** mentor12345

Demo tutor: `tutor@mentorlagbe.com` / `Tutor@12345`. Demo student: `student@mentorlagbe.com` / `Student@12345`.

## Key Features
- 4 collections: `users`, `tuitions`, `applications`, `payments` (BetterAuth also keeps its own `session` and `account` records)
- JWT verification with custom middlewares: `verifyToken`, `verifyStudent`, `verifyTutor`, `verifyAdmin` (roles are checked against the database)
- Server-side search, filters and pagination for tuitions
- Student rules: one application per tuition, cancel only while pending
- Tutor rules: free plan limit of 2 tuitions, edit, close / reopen and delete own tuitions, accept or reject applicants
- Admin tools: platform stats, role management (admins cannot change their own role), tuition approval, transactions
- Stripe Checkout, success-page verification and a **signed webhook** that upgrades the user to Pro and saves the payment once
- ImgBB image upload with the API key kept on the server
- Seed script for demo users, tuitions, applications, reviews and payments
- Live home highlights (newest tuition, Pro tutors, platform numbers)
- One-time role choice for new Google users (never admin)
- Saved tuitions (stored inside the user record) and reviews (stored inside the tuition), so the database stays at 4 collections
- Priority booking: applications from Pro students are flagged and shown first to tutors

## NPM Packages Used
- `cors`
- `dotenv`
- `express`
- `jsonwebtoken`
- `mongodb`
- `nodemon`
- `stripe`

## Run Locally
1. `npm install`
2. Copy `.env.example` to `.env` and fill in the values
3. `npm run dev` (runs on port 5000)

## Environment Variables (`.env`)
| Name | Purpose |
|---|---|
| `PORT` | Local port (default 5000) |
| `CLIENT_URL` | Allowed frontend address (CORS and Stripe redirects) |
| `MONGODB_URI` / `DB_NAME` | MongoDB connection |
| `JWT_SECRET` | Must be the same value as on the client |
| `IMGBB_API_KEY` | ImgBB image upload |
| `STRIPE_SECRET_KEY` | Stripe secret key (test mode) |
| `STRIPE_WEBHOOK_SECRET` | Signing secret of the Stripe webhook |

Secrets are never committed. `.env` is listed in `.gitignore`.

## Seed Demo Data
Add the `SEED_*` values from `.env.example` to `.env`, then run:

    npm run seed

It creates the admin, 4 tutors and 2 students (through BetterAuth so passwords are hashed correctly),
12 approved tuitions (plus 2 pending and 1 rejected), sample applications and 2 sample payments.
Running it again keeps existing data. To rebuild everything: `npm run seed -- --reset`.

## API Overview
**Public**
- `GET /api/tuitions?search=&subject=&classLevel=&mode=&page=&limit=`
- `GET /api/tuitions/latest`, `GET /api/tuitions/filters`, `GET /api/tuitions/:id`
- `GET /api/stats`

**Student (JWT + student)**
- `POST /api/applications`, `GET /api/applications/my`, `GET /api/applications/check/:tuitionId`, `DELETE /api/applications/:id`

**Tutor (JWT + tutor)**
- `GET /api/tutor/stats`
- `POST|GET /api/tutor/tuitions`, `GET|PUT|DELETE /api/tutor/tuitions/:id`, `PATCH /api/tutor/tuitions/:id/toggle`
- `GET /api/tutor/applicants`, `PATCH /api/tutor/applicants/:id`

**Admin (JWT + admin)**
- `GET /api/admin/stats`, `GET /api/admin/users`, `PATCH /api/admin/users/:id/role`
- `GET /api/admin/tuitions`, `PATCH /api/admin/tuitions/:id/status`
- `GET /api/admin/transactions`

**Extras**
- `GET /api/home/highlights` - live hero card data (public)
- `PATCH /api/users/me/role` (JWT) - new Google user picks student or tutor once
- `GET /api/saved`, `GET /api/saved/ids`, `POST|DELETE /api/saved/:id` (JWT + student)
- `GET /api/reviews/can/:tuitionId`, `POST /api/reviews` (JWT + student with an accepted application)

**Payments and uploads**
- `POST /api/payments/checkout` (JWT) - start Stripe Checkout
- `GET /api/payments/verify?session_id=` (JWT) - confirm a payment from the success page
- `POST /api/payments/webhook` - Stripe webhook (signature verified)
- `POST /api/upload` (JWT) - upload an image to ImgBB

## Stripe Webhook Setup
In the Stripe dashboard (test mode) go to Developers, Webhooks and add an endpoint:
`https://<your-server>/api/payments/webhook` with the event `checkout.session.completed`.
Copy its signing secret into `STRIPE_WEBHOOK_SECRET`.
