# Lab Dash
This is an open-source user interface designed to be your internally hosted homepage for your homelab/server. 

<img width="1912" alt="Screenshot 2025-05-08 at 8 58 34 PM" src="https://github.com/user-attachments/assets/55ae6a22-33e3-40ab-b1e2-a8deeaa5239b" />


# Features
Lab Dash features a customizable grid layout where you can add various widgets:
- Shortcuts to your tools/services
- System information
- Service health checks
- Custom widgets and more

Widgets update live: the server pushes new data to every open tab over a single WebSocket connection, and shares one request to each of your services between all viewers.

### Customization
You can easily customize your dashboard by:
- Dragging and reordering
- Changing the background image
- Adding custom search providers
- Custom title and tab name

### Privacy & Data Control
You have complete control over your data and dashboard configuration.
- All data is stored & used on your own device
- Sensitive data is encrypted locally using [AES-256-CBC](https://www.kiteworks.com/risk-compliance-glossary/aes-256-encryption/)
- Only administrator accounts can make changes
- Configurations can be easily backed up and restored

# Installation
This only requires docker to be installed. [Install Docker](https://docs.docker.com/engine/install/). Run using `docker compose`
```yaml
---
services:
  lab-dash:
      container_name: lab-dash
      image: ghcr.io/anthonygress/lab-dash:latest
      privileged: true
      #network_mode: host # for monitoring network usage stats. run `sudo ufw allow 2022/tcp` on ubuntu to allow access through firewall
      ports:
        - 2022:2022
      environment:
        - SECRET=YOUR_SECRET_KEY # required: replace with a random string of at least 32 characters.
        # Lab Dash does not start with this placeholder. Run `openssl rand -base64 32` to generate a key
      volumes:
        - /sys:/sys:ro
        - /docker/lab-dash/config:/config
        - /docker/lab-dash/uploads:/app/public/uploads
        - /var/run/docker.sock:/var/run/docker.sock
      restart: unless-stopped
```

> [!IMPORTANT]
> `SECRET` is required. It signs logins and encrypts the passwords and API keys of your widgets, so Lab Dash does not start without it or with the `YOUR_SECRET_KEY` placeholder, and it warns when the value is shorter than 32 characters. Set it once and keep it. If you change it later, saved widget credentials have to be entered again.

### Environment variables
| Variable | Purpose |
| --- | --- |
| `SECRET` | Required. Random string of at least 32 characters, see above |
| `PORT` | Port the server listens on (default `2022`) |
| `ALLOWED_ORIGINS` | Optional. Comma-separated origins (for example `https://dash.example.com`) allowed to open the live connection when your reverse proxy does not pass the original host name through |
| `UPLOAD_DIRECTORY` | Optional. Folder for uploaded icons and backgrounds (default `public/uploads` inside the app folder, which the compose file mounts) |

# Usage
Lab Dash can aslo be accessed from any web browser via 
- `http://localhost:2022` on the device running the container
- `192.168.x.x:2022` on local network  
- `www.your-homepage.com` using your custom domain name

Lab Dash can also be installed as an app on your computer/phone as a PWA (Progressive Web App):
- Using Google Chrome on Mac/Windows/Android/Linux
- Using Safari on iOS/iPad OS via the share menu > add to homscreen
  
<img width="391" alt="Screenshot 2025-03-24 at 12 13 07 AM" src="https://github.com/user-attachments/assets/2b6ec3b4-5cda-4cd0-b8aa-70185477b633" />  


> [!IMPORTANT]  
> You should assign a static IP address for you server so any LAN/WAN device can access the Lab Dash instance.

Simply copy/download the [docker-compose.yml](docker-compose.yml) or add it to an existing docker-compose file.


## Using a reverse proxy
Live widget data needs a WebSocket connection to `/api/ws`, on the same host and port as the rest of the app. If widgets stay empty and the dashboard shows "Live updates are unavailable", your proxy is not forwarding it.

- **Nginx Proxy Manager**: turn on *Websockets Support* for the proxy host
- **Caddy, Traefik**: works without extra settings
- **nginx**: forward the upgrade headers and the original host

```nginx
location / {
    proxy_pass http://127.0.0.1:2022;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
}
```

## Running Docker compose file

```bash
docker compose up -d
```

This docker container will restart automatically after reboots unless it was manually stopped. This is designed to be run on your hosting server.

## Stopping this docker container
1. Navigate to the directory that this docker compose file is in
2. Run: `docker compose down`

# Local Development
The backend needs a `SECRET` of its own, read from `backend/.env`. Create it once:
```
echo "SECRET=$(openssl rand -base64 32)" > backend/.env
```

```
npm install
npm run dev
```

### Tests
Both suites, from the repository root:
```
npm test
```
One side at a time with `npm run test:backend` or `npm run test:frontend`. Each package also has `npm run test:watch`.

- `backend/test/` uses the Node test runner. `unit/` covers crypto, the config store, request tracking and file helpers, `api/` every HTTP route (auth, config, notes, uploads, app icons, system, health, timezone, rate limits) and the access rules, `realtime/` the WebSocket gateway and poller hub, and `integrations/` each service family (Sonarr/Radarr, Jellyfin/Jellyseerr, DNS blockers, download clients) against fake servers. `helpers/` holds the shared fixture config, HTTP and session helpers. Tests never touch the real config, users or uploads: the fixture points them at a temp folder.
- `frontend/test/` uses Vitest with two projects. `unit/`, `realtime/` and `hooks/` run in Node (the dashboard grid, utilities, the shared socket client, the live-data hook). `components/` renders every React component in jsdom with the API and the socket replaced (`test/components/setup.ts`) and the app's providers around it (`test/components/render.tsx`). `npx vitest run --project components` runs just those.

The deploy workflows run both suites before the Docker image is built, and pull requests run them in `quality-check`.

# Updating
### Portainer
- Navigate to stacks
- Click on the `lab-dash` stack
- Click Editor tab at the top
- Click Update the stack
- Enable Re-pull image and redploy toggle
- Click Update

### Docker CLI:
- `cd /directory_of_compose_yaml`
- `docker compose down`
- `docker compose pull`
- `docker compose up -d`

### Upgrading to 1.4
- `SECRET` is now required. Lab Dash no longer falls back to a built-in value and does not start when `SECRET` is missing or still set to `YOUR_SECRET_KEY`. If your install ran that way, set a value of your own (`openssl rand -base64 32`) and enter the passwords and API keys of your widgets again: they were encrypted with a value anyone could look up.
- Everyone has to log in again once after the upgrade.
- Widgets now receive their data over a WebSocket. Behind a reverse proxy, see [Using a reverse proxy](#using-a-reverse-proxy).
- The backend routes that passed requests through to your services (`/api/radarr`, `/api/sonarr`, `/api/jellyfin`, `/api/jellyseerr`, `/api/qbittorrent`, `/api/deluge`, `/api/transmission`, `/api/sabnzbd`, `/api/nzbget`, `/api/pihole`, `/api/adguard`, `/api/weather`) and the `/api/health?url=` checker were removed. Several of them worked without logging in. Scripts that called them will get a 404.
- Visitors who are not logged in can still see widgets that are not marked admin-only, but only an admin can act on them: pausing downloads, removing queue items, disabling DNS blocking, creating or approving media requests.

# Contributing
Contributions to Lab Dash are welcome! Please follow these guidelines:

- **One feature per PR** - Keep pull requests focused on a single feature or fix
- **Review AI-generated code** - If using AI tools, all code must be thoroughly reviewed and tested before submitting
- **Maintain consistency** - New code must align with the app's existing style, theme, and overall user experience

# Disclaimer
This code is provided for informational and educational purposes only. I am not associated with any of the services/applications mentioned in this project.
