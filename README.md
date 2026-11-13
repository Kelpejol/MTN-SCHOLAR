# Scholars' Choice Vice-Chancellor Award — Voting Platform

MTN Foundation Scholarship · powered by Dragnet

Scholars sign in with their **matric number**, confirm a **one-time code** sent to their registered
email, and cast **one vote** for the Vice-Chancellor who has shown the most commitment to students'
welfare, learning and wellbeing. Votes are counted **by institution**, and results are reported per
**ceremony region** (Lagos, Enugu, Abuja).

Stack: Next.js 16 (App Router) · MySQL 8 + Prisma 6 · Tailwind CSS 4 · ZeptoMail.

---

## Quick start (local)

```bash
npm install
cp .env.example .env          # then fill in SESSION_SECRET and ADMIN_SEED_* (ZeptoMail optional locally)
npm run db:up                 # MySQL 8 in Docker on port 3309
npm run db:migrate            # create tables (safe on a shared database)
npm run db:seed               # 66 institutions, voting window, first admin
npm run dev                   # http://localhost:3000  ·  admin at /admin
```

Without `ZEPTOMAIL_TOKEN` in development, every email (including OTP codes) is printed to the
terminal so you can test the full flow.

## Deploying

Production runs on the shared Azure server behind Apache (alongside other apps), with MySQL.
Branches: **`main`** = production, **`dev`** = integration; deploy a branch with `bash deploy/deploy.sh <branch>`.

Layout on the server (`/var/www/mtn-scholars-app`): `shared/.env` (production settings), `releases/<time>-<commit>/`
(one folder per deploy, last 3 kept), `current` → the live release and `active-color` (blue/green). `/var/www/mtn-scholars` is only the git clone the
code is taken from.

**Every deploy is zero-downtime (blue/green):** `bash deploy/deploy.sh main` (or `dev`) builds the new version beside
the live one, checks the database, starts it on the spare port (blue 3110 / green 3111), health-checks it, then points
Apache at it with a graceful reload and stops the old one. If the build or health check fails, the live site is never
touched; if the switch fails it is reverted automatically.

One-time setup (on the server):

1. **Database.** Put `DATABASE_URL` for the MySQL database that will hold our tables in `shared/.env`. Azure MySQL needs TLS,
   so append `?sslaccept=strict`, and URL-encode special characters in the password (`@` → `%40`).
   All our tables are prefixed `mtnvc_`, so they can share a database with other apps.
2. **Code + env.**
   ```bash
   cd /var/www && git clone https://github.com/Kelpejol/MTN-SCHOLAR.git mtn-scholars
   mkdir -p mtn-scholars-app/shared && cp mtn-scholars/.env.example mtn-scholars-app/shared/.env
   nano mtn-scholars-app/shared/.env && chmod 600 mtn-scholars-app/shared/.env
   ```
   Set `SESSION_SECRET`, `APP_URL=https://mtnfscholars.dragnet.ng`, `ZEPTOMAIL_TOKEN`, `DATABASE_URL`, `ADMIN_SEED_*`
   and `MAIL_DRY_RUN=false`.
3. **First deploy.** `cd /var/www/mtn-scholars && bash deploy/deploy.sh main`, then once, from the live release:
   `cd /var/www/mtn-scholars-app/current && npm run db:seed` (institutions, voting window, first admin).
4. **Apache + HTTPS.** Copy `deploy/apache-mtnfscholars.conf` to `/etc/apache2/sites-available/`, enable it, run
   `apache2ctl configtest`, reload, then `sudo certbot --apache -d mtnfscholars.dragnet.ng`.
   (DNS: an `A` record `mtnfscholars` → the server IP must exist first.)
5. Sign in at `/admin` → **Settings → Send test email**, upload the scholars, check the voting window.

Database safety: `npm run db:migrate` only creates `mtnvc_*` tables and refuses to run any `DROP`/`DELETE`/`TRUNCATE`.
Never run `prisma migrate dev` or `prisma migrate reset` against the shared database. Roll back by hand with
re-running `bash deploy/deploy.sh` on the older commit (`git checkout`/revert on `main` first).

### ZeptoMail checklist
- The domain `dragnet-solutions.com` must be verified in ZeptoMail (SPF + DKIM).
- Use the Mail Agent's **Send Mail Token** as `ZEPTOMAIL_TOKEN`.
- If your account is hosted in the EU/IN region, change `ZEPTOMAIL_API_URL`.

## Branding assets

Replace these placeholder files (same names) with the real logos — PNG with a transparent
background works on the site **and** in emails (email clients don't support SVG):

| File | Used in |
| --- | --- |
| `public/brand/mtn-logo.png` | Site header, admin, emails |
| `public/brand/dragnet-logo.png` | "powered by" lockup, emails |
| `src/app/icon.svg` | Browser tab icon — replace, or delete it and add `src/app/favicon.ico` / `src/app/icon.png` |

Wording (programme name, award name, question) lives in `src/lib/constants.ts` → `BRAND`.

---

## How it works

### Scholar flow
1. Enter matric number → matched ignoring spaces and letter case (`u19ee 1001` = `U19ee1001`).
2. 6-digit code emailed (expires in 10 min, 5 attempts, 60 s resend cooldown, max 6 codes/hour).
3. Ballot: institution (searchable, alphabetical) + Vice-Chancellor's name (free text, reference only).
4. Confirmation step → submit. One vote per matric number is enforced by a database unique
   constraint, so double-submits can't create a second vote.
5. Receipt page + receipt email.

Scholars can only sign in while voting is open (Settings → voting window, or the **Pause** switch).

### Admin console (`/admin`)
| Page | What it does |
| --- | --- |
| Overview | Turnout, leaders per region, votes per day, latest votes |
| Results | Votes per institution, ranked within each ceremony region (ties flagged). Export results CSV, **VC names CSV**, all votes CSV |
| Scholars | Upload CSV/XLSX (preview → import), template download, add/edit/delete, search & filter by voted / not voted, **send reminders** (all who haven't voted, or selected) with live progress and retry |
| Votes | Every vote with time, scholar, institution, region, VC name; filter & export |
| Institutions | Add/edit with **fuzzy duplicate detection**, hide from ballot, delete (only if no votes) |
| Settings | Voting window (WAT), pause/resume, email test, admin accounts, change password |
| Activity log | Audit trail of admin actions |

**Scholar upload rules:** the file must contain `Full Name`, `Matric Number` and `Email` columns
(other columns such as `S/N` are ignored; in multi-sheet workbooks the right sheet is found
automatically). New matric numbers are added, existing ones updated, nothing is deleted. Invalid
rows are listed and skipped.

**Duplicate institutions:** exact matches after normalisation are blocked ("Univ. of Lagos" =
"University of Lagos"). Possible duplicates — reordered words, typos, extra words, initials such as
"FUTA" — show a warning the admin can override. Matching uses `fuzzball` plus generic rules only,
so it keeps working as institutions are added.

### Exports
All CSVs are UTF-8 with BOM (open cleanly in Excel), times in WAT, and free-text values are
protected against spreadsheet formula injection.

## Useful commands

```bash
npm run admin:create -- --email jane@example.com --name "Jane Doe" --password "long-password"   # add admin / reset password
npm run db:studio      # browse the database
npm run typecheck && npm run lint
```

## Security notes
- Sessions are signed HTTP-only cookies; admin pages and APIs re-check the account in the database.
- OTPs are stored as HMAC hashes, never in plain text.
- Admin login is throttled (5 failures per email / 20 per IP per 15 min).
- Admin APIs reject cross-site requests.
- The client spreadsheet (`*.xlsx`) is git-ignored — it contains personal data.
