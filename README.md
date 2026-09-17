# CLOI 🎞 Central Library of Images

This repository can be used to host a photo gallery for sports associations, groups of friends, or any other group of
people that may want to host images centrally on their own server.

![album-view.png](wiki/album-view.png)

Pictures are grouped in albums, where each album is an event that started on a specific date. Albums are sorted by date
on the home page, and users can select an album to view.

## Features

- Self-hosted using Docker
- Possibility to password-protect albums
- EXIF metadata extraction
- Thumbnail generation for fast image viewing
- One central library, not multiple libraries for different users

## Local setup (build from source)

The project consists of two files, a `./server` folder, and a `./client` folder. The server folder consists of a Node.js
Express server that serves as the back-end, while the frontend is built in React using Vite. Images are stored on the
server the back-end is placed on, in a folder named after the album the picture is uploaded in. The project has a
`docker-compose.yml`, and each project has its own `Dockerfile`. Both the `server` and `client` folder need their own
`.env` file, filled with the values below.

```
# server/.env

SERVER_URL=https://123.com
CLIENT_URL=https://123.com
SERVER_PORT=3001
SESSION_SECRET=a-very-secret-key-for-this-project
OIDC_ISSUER=https://login.microsoftonline.com/[TENANT]/v2.0
OIDC_CLIENT_ID="XXX"
OIDC_CLIENT_SECRET="XXX"
DB_PATH="/data/photos.db"
UPLOADS_PATH="/data/uploads"

# client/.env

VITE_CLIENT_PORT=5173
VITE_CLIENT_URL=https://123.com
VITE_SERVER_URL=https://123.com
```

Run locally from the repository root:

```bash
docker compose up --build -d
```

## Production deployment (prebuilt images)

Every push to `main` now triggers `.github/workflows/docker-publish.yml`, which builds and publishes:

- `ghcr.io/timyboy12345/cloi-server:latest`
- `ghcr.io/timyboy12345/cloi-client:latest`

### 1) Prepare your server once

Install Docker and Docker Compose plugin, then create a deployment folder on your server:

```bash
mkdir -p /opt/cloi/{server,client}
cd /opt/cloi
```

Copy `docker-compose.prod.yml` from this repository into `/opt/cloi/docker-compose.yml`.

Create env files:

```bash
# /opt/cloi/server/.env
SERVER_URL=https://photos.your-domain.com
CLIENT_URL=https://photos.your-domain.com
SERVER_PORT=3001
SESSION_SECRET=replace-with-a-long-random-secret
OIDC_ISSUER=https://login.microsoftonline.com/[TENANT]/v2.0
OIDC_CLIENT_ID=XXX
OIDC_CLIENT_SECRET=XXX
DB_PATH=/data/photos.db
UPLOADS_PATH=/data/uploads

# /opt/cloi/client/.env
VITE_CLIENT_PORT=5173
VITE_CLIENT_URL=https://photos.your-domain.com
VITE_SERVER_URL=https://photos.your-domain.com
```

Authenticate Docker to GHCR (required for private package access):

```bash
echo "<GITHUB_PAT_WITH_read:packages>" | docker login ghcr.io -u <github-username> --password-stdin
```

### 2) Deploy or update instantly

From `/opt/cloi` run:

```bash
docker compose pull
docker compose up -d
```

That pulls the latest images built from `main` and restarts containers with the new version.

### 3) Optional one-command update helper

```bash
#!/usr/bin/env bash
set -e
cd /opt/cloi
docker compose pull
docker compose up -d
docker image prune -f
```

Save as `/opt/cloi/update.sh`, `chmod +x /opt/cloi/update.sh`, then run it whenever you want to deploy the latest push.

## Authentication

Right now, the application only supports authentication through OpenID Connect, which means users can log in using their
Microsoft 365 account linked to their organization, a Google login, GitHub, or any other social login.

Once authenticated, users can create and edit albums.
Albums can optionally be protected with an album password from the admin edit page; visitors then need to provide that password (also supported via `?pass=...` in the album URL).
Admins can also manage site-wide master passwords; when at least one master password exists, unauthenticated visitors must enter a valid one before loading albums or photos.

![admin.png](wiki/admin.png)
![album-edit.png](wiki/album-edit.png)
