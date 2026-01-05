# Lab Dash
This is an open-source user interface designed to be your internally hosted homepage for your homelab/server. 

<img width="1912" alt="Screenshot 2025-05-08 at 8 58 34 PM" src="https://github.com/user-attachments/assets/55ae6a22-33e3-40ab-b1e2-a8deeaa5239b" />


# Features
Lab Dash features a customizable grid layout where you can add various widgets:
- Shortcuts to your tools/services
- System information
- Service health checks
- Custom widgets and more

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
        - SECRET=YOUR_SECRET_KEY # any random string for used for encryption.
        # You can run `openssl rand -base64 32` to generate a key
      volumes:
        - /sys:/sys:ro
        - /docker/lab-dash/config:/config
        - /docker/lab-dash/uploads:/app/public/uploads
        - /var/run/docker.sock:/var/run/docker.sock
      restart: unless-stopped
```

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

# Contributing
Contributions to Lab Dash are welcome! Please follow these guidelines:

- **One feature per PR** - Keep pull requests focused on a single feature or fix
- **Review AI-generated code** - If using AI tools, all code must be thoroughly reviewed and tested before submitting
- **Maintain consistency** - New code must align with the app's existing style, theme, and overall user experience

# Disclaimer
This code is provided for informational and educational purposes only. I am not associated with any of the services/applications mentioned in this project.
