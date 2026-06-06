# Add SSO Control Center

## Scope

Add a first usable control center to the standalone `sso-auth-center` project:

- User account center at `/account`
- Admin dashboard at `/admin`
- Admin user detail and status controls
- Admin client list/create/delete-secret-rotation basics
- Audit event browsing
- Tests and documentation

## Boundaries

- Only modify `sso-auth-center/` and this CCG task directory.
- Do not touch the existing HI-Image-Studio app.
- Do not build full MFA, consent screen, third-party developer onboarding, or organization/multi-tenant features in this slice.
