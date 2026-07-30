---
name: turnstile-spin
description: Wire up Cloudflare Turnstile inside a web application.
---
# Cloudflare Turnstile Spin Integration

This skill defines the canonical workflow for adding Turnstile bot protection to an existing application, explicitly skipping dashboard/API steps and using provided credentials.

## Prerequisites
- A valid Cloudflare Turnstile Site Key and Secret Key provided by the user.

## Steps
1. Add the Turnstile script to your HTML head: `<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>`
2. Store the Secret Key in the backend environment as `TURNSTILE_SECRET`.
3. Locate all forms that require bot protection (e.g., login, register, profile updates).
4. Embed the Turnstile widget inside the form:
   `<div class="cf-turnstile" data-sitekey="<YOUR_SITE_KEY>" data-action="<ACTION_NAME>"></div>`
5. Ensure forms pass the generated token (named `cf-turnstile-response`) to backend API endpoints.
6. Create a canonical server-side `siteverify` utility to validate the token against Cloudflare's Turnstile endpoint (`https://challenges.cloudflare.com/turnstile/v0/siteverify`).
7. Update backend route handlers to consume the token and abort on failure before executing any sensitive logic.
