# Firebase authentication runbook

## Runtime behavior

- Google authentication is popup-first on localhost, Firebase Hosting aliases, and the canonical site.
- A blocked popup may fall back to redirect only when `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` exactly equals `window.location.hostname`. Cancellation never triggers a redirect or error toast.
- Email signup/login, Google auth, MFA challenge completion, and restored sessions schedule an idempotent Firestore profile repair. Profile or display-name failures do not reverse a successful Firebase account operation.
- `NEXT_PUBLIC_MFA_ENABLED=false` hides and blocks new TOTP enrollment. Existing TOTP challenges and unenrollment remain supported.

## Release checks

Run the focused regression suite and online, non-mutating Firebase readiness checks:

```bash
npm run test:auth
npm run auth:preflight
```

The preflight verifies public Firebase project identity, email/password and Google provider availability, canonical/local/Firebase authorized domains, the real Firebase OAuth helper response, production redirect mode, and the MFA UI/project assertion. It prints no API keys, submitted synthetic address, credentials, user identifiers, or raw Firebase responses.

A `production_redirect_mode` warning is expected while production remains popup-only with the `firebaseapp.com` auth domain. Any `FAIL` blocks release.

The dedicated preview release command uses a pinned project-scoped Firebase CLI, targets only the `auth-recovery` preview channel in `talent-consulting-acf16`, and expires the channel after seven days. It runs both checks above before attempting a deploy:

```bash
npm run auth:release:preview
```

Do not use `firebase deploy` for this QA gate. Record the preview URL printed by the command and test that exact release before promotion.

## Same-origin redirect fallback activation

Popup-first can ship with the existing `talent-consulting-acf16.firebaseapp.com` auth domain. Activate production redirect fallback only after both external changes are complete:

1. Add `https://talentconsulting.io/__/auth/handler` to the Google OAuth web client's authorized redirect URIs.
2. Configure Firebase Hosting's recommended custom auth domain and set the production `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=talentconsulting.io`.
3. Run `npm run auth:preflight -- --require-same-origin-redirect`; the redirect-mode check must pass.

Local development should keep the Firebase-provided auth domain. Its supported Google flow remains popup-only because localhost intentionally fails the same-origin redirect gate.

## MFA activation

Keep `NEXT_PUBLIC_MFA_ENABLED=false` and the server-side release assertion `FIREBASE_MFA_PROJECT_ENABLED=false` until TOTP is enabled in the Firebase project and tested with a dedicated QA account. At activation time, change both flags to `true` and rerun the preflight. The preflight fails when the assertion is absent or the flags do not match.

## Manual QA and rollout

Use a dedicated non-personal account on localhost and a Firebase preview channel before production:

1. Create an email account, log out, sign back in, refresh, and request a password reset.
2. Test existing-account Google login and first-time Google signup.
3. Close the popup and confirm the modal remains usable with no error. Simulate popup blocking and confirm no unsafe cross-origin redirect begins.
4. Verify resume handoff and an ordinary `/suite` post-auth destination; absolute, protocol-relative, backslash, control-character, and malformed destinations must be ignored.
5. Verify a Google user missing a Firestore profile receives a profile document without authentication being interrupted.
6. Repeat on the canonical domain and both Firebase Hosting aliases, then monitor normalized `auth_lifecycle` outcomes by method, host class, result, and error code.

The preview gate is complete only when every item below has direct evidence:

- [ ] `npm run auth:release:preview` completes and returns an `auth-recovery` preview URL.
- [ ] A newly created email/password account can sign out, sign back in, persist across refresh, and receive a password-reset email.
- [ ] A returning Google user completes popup login and lands on the intended safe destination.
- [ ] A first-time Google user completes popup signup and receives a Firestore profile without delaying authentication.
- [ ] Closing the Google popup leaves the modal usable; popup blocking does not start a cross-origin redirect.
- [ ] Invalid post-auth destinations are discarded and a valid local resume handoff is consumed once.
- [ ] The same build passes smoke checks on the preview URL, `talentconsulting.io`, and the Firebase Hosting aliases after promotion.
- [ ] Normalized `auth_lifecycle` monitoring shows no unexplained increase in popup, credential, profile-bootstrap, or routing failures.

No account migration is required. Roll back by redeploying the prior Firebase release; account and Firestore data are not mutated by the rollout itself.
