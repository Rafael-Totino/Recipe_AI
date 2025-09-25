# Recipe AI - Frontend

React + Vite front-end for the recipe assistant.

## Scripts

```bash
npm install
npm run dev
npm run build
npm run lint
```

## Environment setup

Create a `.env.local` (or update the existing `.env`) in the `frontend` folder with:

```
VITE_API_BASE_URL=http://localhost:8000
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<public-anon-key>
```

The Supabase values come from project settings > API. Keep the service role key on the backend only.

## Features

- Email and Google sign-in powered by Supabase Auth.
- Dashboard with summary cards, favorite recipes, and newly imported content.
- Persistent AI chat assistant for search and cooking questions.
- Import recipes from URLs or create them manually.
- Detailed recipe page with media, ingredients, steps, notes, and sharing actions.
- Settings page for dietary preferences that personalize the assistant.
