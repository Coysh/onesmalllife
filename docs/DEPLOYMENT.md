# Deployment — Ploi

Deploying One Small Life to a VPS with [Ploi](https://ploi.io), auto-deploying
from GitHub on push to `main`.

The app is a plain Laravel monolith: PHP-FPM + Nginx + MySQL, with assets
built by Vite at deploy time. Sessions, cache, and queue all sit on the database
(`SESSION_DRIVER`/`CACHE_STORE`/`QUEUE_CONNECTION=database`), so **no Redis is
required**.

---

## 1. Provision the server

In Ploi → **Servers → Create server**, pick your provider (Hetzner, DigitalOcean,
Vultr…) or choose *Custom server* to have Ploi provision a machine you already own.

Settings that matter:

| Setting | Value |
|---|---|
| Server type | Web server |
| PHP version | **8.3 or newer** (`composer.json` requires `^8.3`) |
| Database | **MySQL 8** — Ploi's default, nothing to change |
| Server size | 1 vCPU / 2 GB RAM is enough to start |

> MySQL is what Ploi installs by default, so the database needs no special
> handling at provision time. (The project ran on PostgreSQL until 2026-07-20 —
> see `DECISIONS.md` D20 for why it moved.)

Provisioning takes a few minutes. Ploi emails you the database root credentials —
keep them.

## 2. Install Node on the server

Ploi does not always install a Node version new enough for Vite 8, which needs
**Node 20.19+**. On the server (Ploi → Server → **Console**, or over SSH):

```bash
node -v
```

If it is missing or below 20.19, install Node 20 via Ploi → Server → **Packages →
NodeJS**, choosing version 20 or 22. Verify again with `node -v` before continuing —
a stale Node is the most common cause of a failing first deploy.

## 3. Create the site

Ploi → your server → **Sites → Add site**.

- **Domain**: e.g. `onesmalllife.com` (or a subdomain for staging)
- **Project type**: Laravel
- **Web directory**: `/public`

## 4. Connect the GitHub repository

On the site → **Repository** tab:

- Provider: **GitHub**
- Repository: `Coysh/onesmalllife`
- Branch: `main`
- Leave **Install Composer dependencies** ticked

Ploi adds a deploy key to the repo and clones it. If the clone fails, check that
the deploy key was actually accepted under GitHub → repo → Settings → Deploy keys.

## 5. Create the database

Ploi → server → **Databases → Create database**.

- Name: `one_small_life`
- User: `one_small_life`
- Password: generate a strong one and record it

Ploi shows the connection host and port (MySQL defaults to `127.0.0.1:3306`).

Create it with `utf8mb4` / `utf8mb4_unicode_ci` if Ploi offers the choice —
species and campaign names are free text and users will put emoji in them.

## 6. Configure the environment

Site → **Environment** tab. This is the production `.env`; it is never committed.
Set at minimum:

```dotenv
APP_NAME="One Small Life"
APP_ENV=production
APP_DEBUG=false
APP_URL=https://onesmalllife.com

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=one_small_life
DB_USERNAME=one_small_life
DB_PASSWORD=the-password-from-step-5

SESSION_DRIVER=database
CACHE_STORE=database
QUEUE_CONNECTION=database

LOG_CHANNEL=stack
LOG_LEVEL=error
```

`APP_DEBUG=false` matters: Laravel's debug pages leak environment variables,
including database credentials, to anyone who triggers an error.

**Mail.** Breeze ships password reset and email verification, so a real mailer is
needed — `MAIL_MAILER=log` silently swallows those emails. Add your provider's
credentials (Postmark, Mailgun, SES, Resend…):

```dotenv
MAIL_MAILER=smtp
MAIL_HOST=smtp.your-provider.com
MAIL_PORT=587
MAIL_USERNAME=...
MAIL_PASSWORD=...
MAIL_FROM_ADDRESS="hello@onesmalllife.com"
MAIL_FROM_NAME="One Small Life"
```

Save — Ploi writes the file. Then generate the app key once, from site → **Console**:

```bash
php artisan key:generate --force
```

Losing `APP_KEY` later invalidates every session and any encrypted column, so
copy it somewhere safe.

## 7. Set the deploy script

Site → **Deploy script**. Replace the default with:

```bash
cd {SITE_DIRECTORY}

git pull origin $FORGE_SITE_BRANCH

# PHP dependencies — production only, optimised autoloader
composer install --no-interaction --prefer-dist --optimize-autoloader --no-dev

# Front-end build (Vite 8 needs Node 20.19+)
npm ci
npm run build

# Database
php artisan migrate --force

# Cache config, routes, views for production
php artisan config:cache
php artisan route:cache
php artisan view:cache

# Reload PHP-FPM so the new code and caches take effect
echo "" | sudo -S service php8.3-fpm reload
```

Notes:

- `--no-dev` keeps Pest, Pint, and Faker off the server.
- `npm ci` (not `npm install`) installs exactly what `package-lock.json` pins.
  Vite build tooling lives in `devDependencies`, so do **not** pass `--omit=dev`
  here or the build will fail.
- Adjust `php8.3-fpm` to the PHP version you actually provisioned.
- `php artisan migrate --force` is required — without `--force` Artisan refuses to
  run migrations non-interactively in production.

Click **Deploy now** and watch the log. Common first-deploy failures: Node too
old (step 2), database credentials wrong (step 6), or `APP_KEY` not yet generated
(step 6).

## 8. Enable auto-deploy

Site → Repository → toggle **Quick deploy**. Ploi installs a GitHub webhook and
runs the deploy script on every push to `main`.

## 9. Enable HTTPS

Site → **SSL → Let's Encrypt → Request certificate**. Point the domain's A record
at the server IP *before* requesting, or issuance fails validation. Once issued,
enable the redirect so all traffic is HTTPS.

## 10. Queue worker (optional, for now)

Nothing in the app dispatches queued jobs yet, so this can wait. When something
does — emails, portrait rendering — add it under site → **Queue → New worker**:

- Connection: `database`
- Queue: `default`
- Processes: 1

Ploi supervises it and restarts it on deploy. If you add a worker, also append
`php artisan queue:restart` to the deploy script so workers pick up new code
rather than running the old copy held in memory.

## 11. Scheduler (optional)

Only needed once `routes/console.php` defines scheduled tasks. Server → **Cron
jobs → New cron job**:

- Command: `php /home/ploi/onesmalllife.com/artisan schedule:run`
- Frequency: every minute
- User: `ploi`

---

## Verifying a deploy

```bash
php artisan about          # environment, drivers, cached-config status
php artisan migrate:status # every migration should read "Ran"
```

Then, in a browser: register an account, create a lineage, play a stage, reload
to confirm the autosave restored, and check that the built assets under
`public/build` are being served (no 404s in the console).

## Routine operations

**Roll back a bad deploy.** Ploi keeps no release history for the default Laravel
deploy script (it deploys in place, not via symlinked releases), so roll back with
git and redeploy:

```bash
git revert <bad-sha> && git push origin main
```

Reverting is safer than resetting `main`, since a migration may already have run
against production data. If the bad deploy included a migration, write a new
migration to undo it rather than relying on `migrate:rollback` — rollback is only
as good as the `down()` method.

**Clear stale caches.** After editing environment variables in Ploi, the cached
config still holds the old values:

```bash
php artisan config:clear && php artisan config:cache
```

**Read logs.** Site → **Logs** in Ploi, or `tail -f storage/logs/laravel.log`.

## Backups

Campaign saves are the only irreplaceable data here, and they live entirely in
MySQL. Set up Ploi → server → **Backups** against the `one_small_life`
database, to an off-server destination (S3, Backblaze, DigitalOcean Spaces).
Daily is fine. Test a restore once — an untested backup is a guess.
