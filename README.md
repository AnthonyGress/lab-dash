# Jellyfin Console
This is an open-source user interface made specifically for managing jellyfin and related services from a single, unified web management console. 

<img width="707" alt="jellyfin-console" src="https://github.com/user-attachments/assets/845afc94-b8a4-484c-88e2-77cb5486da5a" />

# Docker compose Mac command

```bash
docker-compose build --build-arg HOST_IP=$(ipconfig getifaddr en0) && docker-compose up
```


# Docker compose Linux command

bash
```bash
docker-compose build --build-arg HOST_IP=$(hostname -I | awk '{print $1}') && docker-compose up
```

# Running locally
```
npm install
npm run dev
```
