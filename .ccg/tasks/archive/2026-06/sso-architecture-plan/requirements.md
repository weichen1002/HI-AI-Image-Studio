# SSO Architecture Plan

## User Need

Design a unified login site for multiple future web platforms, so users register and sign in once instead of maintaining separate accounts on every platform.

## Current Context

- Existing app has local email/password registration and login.
- Backend stores users in SQLite and issues an HttpOnly `session` cookie.
- Frontend detects login status via `/api/me`.

## Risk

Authentication is a high-risk domain. The plan must preserve secure session handling, clear app boundaries, revocation, and migration from existing local accounts.
