# VPS Policy

This document defines the standard layout for hosting multiple projects on one VPS without sharing `root`, sharing app users, or keeping secrets inside app directories.

## Principles

- Humans log in as themselves.
- Apps run as non-login service accounts.
- Each project has its own group, config directory, service, and nginx site.
- SSH uses keys only.
- `root` is for server administration, not daily app work.
- Secrets live outside the app tree.
- Public apps are exposed only through nginx, not direct app ports.

## Access Model

Human users:
- `mj`
- other teammates as their own Linux users

Per-project identities:
- service account: short, shell-safe name like `webinarops`
- collaboration group: `<project>-dev`, for example `webinarops-dev`

Rules:
- never SSH as the service account
- never share Linux users
- never share SSH keys
- disable `root` SSH login

Example:
- human: `mj`
- human: `aqil`
- service account: `webinarops`
- project group: `webinarops-dev`

## Directory Layout

Per project:
- app code: `/var/www/<project>`
- optional split layout:
  - `/var/www/<project>/current`
  - `/var/www/<project>/shared`
- config and secrets: `/etc/<project>`
- env file: `/etc/<project>/.env`

Ownership pattern:
- app code: `<service-user>:<project>-dev`
- runtime-owned writable paths: `<service-user>:<service-user>`
- secrets/config: `root:<project>-dev`

Permissions:
- project directory: group writable only where collaboration is needed
- env file: `640`
- config directory: `750`

## SSH Standard

`/etc/ssh/sshd_config` should enforce:

```conf
PermitRootLogin no
PubkeyAuthentication yes
PasswordAuthentication no
AllowUsers mj aqil
```

Notes:
- keep `PasswordAuthentication yes` temporarily during initial onboarding if needed
- switch it back to `no` after all intended users confirm login

## Service Standard

Prefer direct `systemd` services over PM2 wrappers.

Example:

```ini
[Unit]
Description=Webinar Ops Next.js app
After=network.target

[Service]
Type=simple
User=webinarops
Group=webinarops
WorkingDirectory=/var/www/webinar-ops
Environment=NODE_ENV=production
EnvironmentFile=/etc/webinar-ops/.env
ExecStart=/usr/local/bin/npm start -- --port 3010
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Rules:
- service account must use `/usr/sbin/nologin`
- do not run app services as human users
- do not rely on hidden daemon state like PM2 dumps unless there is a strong reason

## Nginx Standard

Each project gets one canonical nginx site file and one enabled symlink.

Example:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name webinarops.vibeship.in;

    location / {
        proxy_pass http://127.0.0.1:3010;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Rules:
- only nginx listens publicly
- app ports stay on localhost
- one domain per site file
- remove stale symlinks and duplicate aliases
- add TLS with Let’s Encrypt after DNS is in place

## Cockpit Standard

- host Cockpit on a separate subdomain, for example `cockpit.vibeship.in`
- proxy Cockpit through nginx
- bind Cockpit itself to `127.0.0.1:9090`
- require HTTPS
- keep admin dashboards separate from public app domains

## Sudo Model

Default:
- `mj` has normal `sudo` with password
- teammates get no blanket sudo

If needed, grant narrow command-level sudo per project.

Example:

```conf
aqil ALL=(root) NOPASSWD: /bin/systemctl status webinarops, /bin/systemctl restart webinarops, /bin/systemctl start webinarops, /bin/systemctl stop webinarops, /bin/journalctl -u webinarops
```

Rules:
- avoid `NOPASSWD: ALL`
- prefer temporary escalation for one-off migration work
- remove stale sudoers files after migrations

## Project Onboarding Checklist

1. Create the service account.
2. Create the project group.
3. Add only the intended humans to that group.
4. Create `/var/www/<project>` and `/etc/<project>`.
5. Put secrets in `/etc/<project>/.env`.
6. Set the service account shell to `/usr/sbin/nologin`.
7. Create the `systemd` unit.
8. Keep the app port on localhost.
9. Create one nginx site for the real domain.
10. Add DNS.
11. Issue Let’s Encrypt TLS.
12. Verify local app health and public HTTPS.
13. Remove temporary migration sudo rules.

## Audit Checklist

Run these when reviewing a project on the VPS:

```bash
id mj
id <teammate>
getent passwd <service-user>
getent group <project>-dev
stat /etc/<project>/.env
systemctl status <project> --no-pager
ls -la /etc/nginx/sites-enabled
ss -tulpn | grep -E ':80|:443|:<app-port>'
```

## Anti-Patterns

- `ssh root@server`
- `ssh webinarops@server`
- secrets inside `/var/www/<project>`
- public app ports like `0.0.0.0:3010`
- multiple nginx aliases for one site without intent
- PM2 daemon state as the only source of truth
- shared human logins
- permanent `NOPASSWD: ALL`

## Current Example: `webinarops`

- service account: `webinarops`
- project group: `webinarops-dev`
- app dir: `/var/www/webinar-ops`
- env dir: `/etc/webinar-ops`
- service: `webinarops.service`
- public domain: `webinarops.vibeship.in`
- admin domain: `cockpit.vibeship.in`
