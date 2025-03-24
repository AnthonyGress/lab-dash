# Lab Dash
This is an open-source user interface designed to be your internally/externally hosted homepage for your homelab/server. 

# Installation
This only requires docker to be installed. [Install Docker](https://docs.docker.com/engine/install/)

# Usage
This application can be installed as an "app" on your computer/phone as a PWA (Progressive Web App) via:
- Google Chrome browser on Mac/Windows/Android/Linux
- Safari on iOS/iPad OS via the share menu > add to homscreen
  
Lab Dash can be accessed locally from any web browser via `http://localhost:2022` or `192.168.x.x:2022` which should be your servers local IP address or url CNAME `www.your-homepage.com`.

> [!IMPORTANT]  
> You should assign a static IP address for you server so any LAN/WAN device can access the Lab Dash instance.

Simply copy/download the [docker-compose.yml](docker-compose.yml) or add it to an existing docker-compose file.

<img width="1511" alt="Screenshot 2025-03-23 at 11 48 56 PM" src="https://github.com/user-attachments/assets/449c8744-58ca-46f2-bbf0-7eb953ede4da" />
<img width="391" alt="Screenshot 2025-03-24 at 12 13 07 AM" src="https://github.com/user-attachments/assets/2b6ec3b4-5cda-4cd0-b8aa-70185477b633" />

## Running Docker compose file

```bash
docker compose up -d
```

This docker container will restart automatically after reboots unless it was manually stopped. This is designed to be run on your hosting server.

## Stopping this docker container
1. Navigate to the directory that this docker compose file is in
2. Run: `docker compose down`

# Local Development
```
npm install
npm run dev
```

# Disclaimer
This code is provided for informational and educational purposes only. I am not associated with any of the services/applications mentioned in this project.
