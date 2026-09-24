# React + Vite

## Supabase setup

Copy `.env.example` to `.env.local` and fill in the Supabase project URL and anon key. Then paste [supabase/schema.sql](supabase/schema.sql) into the Supabase SQL editor and run it.

The app keeps a local fallback when the environment variables are missing. Once configured, onboarding creates a `chamas` row and dashboard changes sync to that row. The checked-in schema includes temporary anonymous policies for this MVP; replace them with authenticated, owner-scoped policies before production use.

To clear the current Supabase chama data before launch, run [supabase/reset-chamas.sql](supabase/reset-chamas.sql) in the Supabase SQL editor. After that, authenticated users can create their own chama from the `Start your chama` flow.

To enforce chairman-only chama creation on an existing project, also run [supabase/owner-controls.sql](supabase/owner-controls.sql) in the Supabase SQL editor. The chairman is the user who creates the chama; only that account can add members or approve join requests.

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.
