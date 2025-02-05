# Dasharr / Labarr / Commandarr
This is an open-source user interface made specifically for managing jellyfin and related services from a single, unified web management console. 

# Installation
This only needs docker to be installed. [Install Docker](https://docs.docker.com/engine/install/)

# Usage
This PWA can be installed as an "app" on your computer/phone as a PWA (Progressive Web App) via chrome browser (or safari on iOS/iPad OS).
It can be accessed locally via any web browser via `http://localhost:2022` or `192.168.x.x:2022` which should be your servers local IP address.

> [!IMPORTANT]  
> If you want to use your server's IP address (so any device on your LAN/WAN can access the Jellyfin Console you need to have the .env file with `HOST_IP=192.168.x.x` filled out with your server's local IP address. This needs to be at the same level directory as the docker-compose file.)

Simply copy/download the docker-compose.yml or add it to an existing docker-compose file. Optionally include the `.env` file with your servers LAN/WAN IP address. Then run the docker-compose file.

<img width="1227" alt="jellyfin-console-desktop" src="https://github.com/user-attachments/assets/18cb497b-8295-488e-95a1-4b7aef0ded56" />
<img width="391" alt="jellyfin-console-mobile" src="https://github.com/user-attachments/assets/1bcdbb4e-c7ae-44a9-8230-37860000f124" />

## Running Docker compose file
> [!IMPORTANT]  
> Make sure to update the `.env` file with the correct IP of your local server

```bash
docker compose up -d
```

This docker container file will restart automatically after reboots unless it was manually stopped. This was designed to be run on your hosting server.

## Stopping this docker container
1. Navigate to the directory that this docker compose file is in
2. Run: `docker compose down`

# Local Development
```
npm install
npm run dev
```

# Disclaimer
This code is provided for informational and educational purposes only. I am not responsible for the actions performed by any users of this code and I am not associated with any of the services/applications mentioned in this project.
