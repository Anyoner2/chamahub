# React + Vite

## Supabase setup

Copy `.env.example` to `.env.local` and fill in the Supabase project URL and anon key. Then create the initial table in the Supabase SQL editor:

```sql
create table public.chamas (
	id uuid primary key default gen_random_uuid(),
	name text not null,
	city text default '',
	goal jsonb not null,
	members jsonb not null default '[]'::jsonb,
	contributions jsonb not null default '[]'::jsonb,
	balance integer not null default 0,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);
```

The app keeps a local fallback when the environment variables are missing. Once configured, onboarding creates a `chamas` row and dashboard changes sync to that row. Authentication and row-level security should be added before production use.

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.
