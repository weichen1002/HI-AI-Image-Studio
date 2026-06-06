# Add SSO Account Security

## Scope

Extend the standalone `sso-auth-center` project with account security basics needed before real use:

- Email verification token flow
- Password reset token flow
- Basic rate limiting for auth-sensitive endpoints
- Tests and documentation

## Boundaries

- Only modify `sso-auth-center/` and this CCG task directory.
- Do not change the existing HI-Image-Studio app.
- Do not implement full third-party developer portal, MFA, or consent screen in this slice.
