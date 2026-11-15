# QA retest follow-up — 15 November 2026

The supplied retest report v2.0, dated 14 November 2026, confirms that BUG-001 through BUG-007 were deployed and verified on production, with no regressions observed. It identifies one remaining application defect: BUG-008, submitting from the confirmation screen after the voter session expires.

## BUG-008 fix

The submit action already returned “Your session has expired. Please sign in again.” for a missing session. The optimistic route guard intercepted the action POST before it could run and redirected it to the landing page. Next.js then received an HTML page where its client action dispatcher expected an action response, causing the generic error screen.

Voter action POSTs now reach the action's own authentication checks. Ordinary unauthenticated page visits and ordinary POSTs still redirect to sign-in. The admin route guard is unchanged. Action headers do not confer authentication or permission to write votes.

The submit action explicitly marks session-expired results. The confirmation screen displays the expiry message and replaces the submission controls with a “Sign in again” link. The same recovery path handles a scholar deleted during voting.

## Verification

- `npm test`: 17 tests pass, including four new proxy regression tests. The new tests failed against the original guard for missing and expired/invalid cookies, then passed with the fix.
- `npm run typecheck` and `npm run lint`: pass.
- A temporary isolated Next.js app used the actual proxy, submit action, session/token code and ballot component, with synthetic database/mail substitutes. The original proxy reproduced the reported crash through the real Next.js action transport.
- With the fix, Chrome checks at 1280×800 and 390×844 passed for missing, expired and invalid cookies and a deleted scholar. Each returned the expiry message, offered a working sign-in link and wrote zero votes or emails. Missing/expired/invalid sessions did not query the database.
- Normal submission redirected to the receipt, with exactly one synthetic vote and one receipt. A repeated submission produced no extra vote or email. Unauthenticated GET `/vote` continued to redirect to sign-in.
- The full production build remains unverified locally because of the previously recorded Turbopack CSS-worker port restriction. The isolated app verifies the Next.js action protocol but does not replace the deployment build or a production QA retest.

No production database or email service was used for these checks.

## Deployment and retest

1. Deploy the follow-up commit using the existing deployment script and confirm its build and health checks pass.
2. Sign in using a QA scholar and reach the ballot confirmation screen.
3. Remove only that browser's `vc_voter` cookie, then press Confirm. Expect the session-expired message and “Sign in again”, with no generic crash page and no new vote.
4. Follow the sign-in link, authenticate again and submit normally. Confirm one vote and one receipt.

## Other report items

- OBS-001 remains an external DNS finding for Dragnet IT.
- Ballot search by institution initials (FUTA, UNILAG, OAU, ABU) is an optional product change, not a regression; it is not included in this fix.
- Admin account/password tests, physical WebKit/Gecko checks and real Gmail/Outlook inbox placement remain outstanding from QA's report.
- The report records 55 QA scholars and 11 QA votes as of its handover. Their current counts must be previewed before any cleanup; no cleanup was performed here.
