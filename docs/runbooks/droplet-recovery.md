# Droplet recovery

Use this procedure when provisioning a replacement server. The normal GitHub Actions workflow assumes the repository, Docker, environment file, and bind-mount targets already exist.

## Before rebuilding

Recover the PostgreSQL and Caddy volumes from a snapshot when possible. `postgres_data` contains all application data, including user API tokens and push registrations. Starting with an empty volume signs every user out and removes all push recipients.

Prepare two SSH keypairs:

| Keypair | Public key | Private key |
|---|---|---|
| Server deploy key | GitHub repository deploy keys, read-only | server user's `~/.ssh/` |
| Actions key | server user's `~/.ssh/authorized_keys` | GitHub secret `DROPLET_SSH_KEY` |

The checkout and keys must belong to the same user configured in `DROPLET_USER`. Add GitHub to the server user's known hosts so automated pulls do not wait for confirmation:

```bash
ssh-keyscan github.com >> ~/.ssh/known_hosts
```

## Provision the host

1. Point `api.dlwltkd.com` at the replacement server. Caddy cannot obtain a certificate until DNS resolves to it. When Cloudflare manages the record, use DNS-only mode during certificate provisioning; a proxied record can intercept the ACME challenge and does not expose the legacy port 8000.
2. Allow inbound ports 22, 80, 443, and the temporary legacy API port 8000 in the cloud firewall.
3. Install Docker with Compose v2 and enable the daemon.

On Ubuntu:

```bash
apt-get update
apt-get install -y docker.io docker-compose-v2
docker compose version
systemctl enable --now docker
```

Docker published ports can bypass `ufw` rules because Docker adds its own iptables rules. Treat the provider's cloud firewall as the enforcement boundary.

## Restore the service

```bash
git clone <repository-ssh-url> ~/learnus
cd ~/learnus
mkdir -p error_log
touch api_debug.log
cp .env.example .env
```

Clone the same repository whose `main` branch triggers `.github/workflows/deploy.yml`; the workflow later runs `git pull origin main` in this checkout.

Edit `.env` and set a new strong `POSTGRES_PASSWORD` and the provider `OPENAI_API_KEY`. Restore optional limit and worker values if the previous server used non-default settings.

Then start the stack:

```bash
docker compose up -d --build
docker compose ps
docker compose logs -f api worker caddy
```

Expect `learnus_caddy`, `learnus_api`, `learnus_worker`, and `learnus_db`. The API calls `init_db()` during import; `Base.metadata.create_all()` creates missing tables and guarded startup migrations add missing columns. There is no separate migration command.

## Restore automation

Set or verify the GitHub Actions secrets listed in [Deployment](../deployment.md#github-actions-deployment). Confirm that:

- `DEPLOY_PATH` points to the restored checkout.
- The checkout is owned by `DROPLET_USER`.
- `git pull origin main` succeeds as that user without a password or host-key prompt.
- The full Actions private key, including its header, footer, and trailing newline, is stored in `DROPLET_SSH_KEY`.

Trigger a deployment with a normal push to `main` and verify the Actions test and deploy jobs.

## Verification

```bash
curl https://api.dlwltkd.com/version
docker compose ps
docker compose logs --tail=100 api worker caddy db
```

When checking whether app traffic reaches the server, watch API and Caddy logs and send a known request first. An absent application request is meaningful only after the known request proves the monitor is working.

```bash
docker compose logs -f --tail=0 api caddy
```

If the server is healthy but the installed app contacts an old address, follow the [stale API URL incident](../incidents/2026-08-15-stale-api-url.md).
