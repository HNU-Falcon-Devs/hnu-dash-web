# Supabase foundation

This directory reserves the repository root for the future Supabase/PostgreSQL backend. No schema, migration, seed data, hosted-project link, or credentials are included yet.

When backend implementation begins, local development is expected to use the Supabase CLI and its local containers:

1. Install the Supabase CLI and a supported container runtime.
2. Initialize the project in this repository with `supabase init` if no CLI configuration exists.
3. Start the local stack with `supabase start`.
4. Create reviewed migrations for agreed domain changes; do not invent tables ahead of requirements.
5. Keep credentials and machine-specific environment files out of Git.

The web foundation does not require Supabase to build or test.
