# Google OAuth development setup

This Web implementation consumes the approved Backend Milestone 1
[contract](https://github.com/HNU-Falcon-Devs/hnu-dash-backend/blob/main/docs/integration/milestone-1-web.md).
Backend Supabase Auth and RLS remain authoritative. No HNU MIS integration or
password collection is part of this application.

## Google Cloud setup (human dashboard action)

1. In the [Google Cloud console](https://console.cloud.google.com/), use the
   Google Auth Platform > Branding, Audience, Data Access, and Clients screens.
   Set app name HNU DASH, support/contact email and development consent details.
2. Audience: choose **Internal only if the Cloud project belongs to HNU's Google
   Workspace organization and the institution authorizes it**. Otherwise use
   External for development. External testing/publishing rules apply; verify
   who can actually access the app. The Workspace admin may block third-party
   OAuth clients even when an External project is configured.
3. Under Data Access, request only identity scopes: `openid`,
   `https://www.googleapis.com/auth/userinfo.email`, and
   `https://www.googleapis.com/auth/userinfo.profile`. Do not request Drive,
   Classroom, Gmail, student records, or any Workspace API scopes.
4. Create an OAuth client of type **Web application**. Configure:
   - Authorized JavaScript origin: `http://localhost:3000`.
   - Authorized redirect URI:
     `https://miakqdtpimcuestmyuqy.supabase.co/auth/v1/callback`.
   This Google redirect URI is **not** Next.js's `/auth/callback`.
5. Store the Client ID and Client Secret directly in the Supabase Dashboard,
   **Authentication > Sign In / Providers > Google**, and enable the provider.
   Do not put either secret in the Web repository or paste it into chat.
6. If an HNU account receives a third-party application blocked/approval
   error, ask the HNU Google Workspace administrator to review or allow the
   app in Workspace Admin > Security > Access and data control > API controls.
   No Workspace administrator access is assumed.

## Supabase hosted development setup

Project: `hnu-dash-dev` (`miakqdtpimcuestmyuqy`, Singapore).

- Authentication > URL Configuration: set Site URL to
  `http://localhost:3000` for local development; add the **exact**
  `http://localhost:3000/auth/callback` to the Redirect URLs allow list.
  Add only actual development/previews as separate exact entries. Do not
  introduce broad wildcards without review.
- Authentication > Hooks > Before User Created: confirm the hosted
  Postgres function hook `public.restrict_hnu_signup` is **enabled**, not
  merely present in PostgreSQL. Keep email confirmation enabled.
- Verify Google OAuth sign-in generates an email-confirmed
  `@hnu.edu.ph` user. The existing `public.hnu_verified_user()` relies on
  `auth.users.email_confirmed_at` and the confirmed email domain.
  If this assumption fails, escalate to the Backend owner; no frontend
  bypass and no unapproved migrations.
- Keep the existing email/password development test account temporarily
  while OAuth is validated. **Removing password inputs from Web does not
  disable password sign-in at Supabase.** Provider-level retirement requires
  a separate approved change after tests pass.

## Local Web setup

Run under Node.js 24:

```bash
cp .env.example .env.local
# Replace only NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY with the public key from Supabase.
npm ci
npm run dev
```

Use `http://localhost:3000/login`. The browser begins Google OAuth using
a domain **hint**; it is not the enforcement mechanism. Supabase runs the
existing signup hook, and the Web callback and every protected page call
`hnu_verified_user`, which checks the confirmed auth.users identity. RLS
continues to govern data access. No user-controlled claims or role metadata
grant administrative rights.

The session uses Supabase SSR PKCE code exchange and cookie storage. Next.js
Proxy refreshes tokens; Sign out revokes the Supabase session. The home page
is protected; other navigation areas are still presentation-only.

## Live verification checklist (not replaceable with unit tests)

1. Signed-out request to `/` redirects to `/login`.
2. An approved verified HNU Workspace account signs in successfully and
   returns through `/auth/callback`.
3. Refresh and reopen the app: authentication persists until logout/expiry.
4. Sign out, then retry `/`: the protected workspace remains inaccessible.
5. Attempt to sign in using a personal Google account and an account outside
   `@hnu.edu.ph`: account creation must fail through Backend hook (check
   hosted Auth logs); existing unauthorized sessions must fail the server-side
   `hnu_verified_user` check.
6. Independently confirm no administrator row or organization membership is
   granted to a newly created account; signup never binds student IDs.
7. Confirm Backend RLS denies writes to administrative and roster operations
   for a newly created ordinary user. Do not write real student data to tests.
8. Check the provider's account email and confirmation timestamp. If a valid
   HNU account is not marked confirmed, stop and investigate the provider
   assumption before claiming the integration is complete.

## References

- [Supabase Google login](https://supabase.com/docs/guides/auth/social-sign-in/auth-google)
- [Supabase Next.js SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client)
- [Supabase redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)
- [Google OAuth consent](https://developers.google.com/workspace/guides/configure-oauth-consent)
