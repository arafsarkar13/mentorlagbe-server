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
