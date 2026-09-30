# Operations and recovery

## Before public deployment

Confirm image tags are available, review upstream release/security notes, and keep n8n and runners aligned. Place a TLS reverse proxy on a controlled network; expose only the webhook routes you need. Protect the editor separately, enforce ingress rate limits and payload limits, and configure proxy trust precisely. Run authenticated webhook tests, inspect runner connectivity, and verify unauthenticated requests are rejected. This repository's localhost configuration is designed for evaluation.

Check readiness with `curl http://localhost:5678/healthz/readiness` and containers with `docker compose ps`. Use `docker compose logs --tail=100 n8n task-runners` when diagnosing startup. Do not share logs without checking for sensitive details. Demo workflows disable persisted execution data to reduce exposure.

## Backup

Back up PostgreSQL, the n8n data volume, and the encryption key together. Use restricted, encrypted off-host storage with retention appropriate to the business. The following Bash examples assume a local Docker host:

```sh
mkdir -p backups
docker compose stop n8n task-runners
docker compose exec -T postgres pg_dump -U n8n n8n > backups/n8n.sql
docker compose run --rm --no-deps --entrypoint sh n8n -c 'tar czf /home/node/.n8n/backup.tar.gz -C /home/node/.n8n --exclude=backup.tar.gz .'
docker compose cp n8n:/home/node/.n8n/backup.tar.gz backups/n8n-data.tar.gz
docker compose run --rm --no-deps --entrypoint sh n8n -c 'rm -f /home/node/.n8n/backup.tar.gz'
docker compose start n8n task-runners
```

The backup archive is temporarily written to the volume and removed after copying. Verify that no live workflow is running before stopping services. Keep an encrypted copy of `N8N_ENCRYPTION_KEY` separately; do not commit it. Backup commands require a working Docker stack and must be tested in your environment.

## Restore

Restore into an isolated environment with the same image version and encryption key. Start PostgreSQL first, restore the dump into a clean n8n database, restore the archived n8n volume with the correct node-user ownership, then start n8n and task runners. Review imported workflows and keep live delivery disabled until credentials and webhook authentication have been tested. Perform periodic restore drills; an untested archive is not reliable recovery evidence.

## Safe updates

Back up before changing tags. Run `docker compose pull`, `docker compose config --quiet`, then `docker compose up -d`. Verify readiness, owner login, credentials, all demo webhooks, and runner tasks. Database migrations may prevent a simple image rollback, so keep a matching pre-upgrade database backup. Never remove named volumes as an upgrade step.
