# Jellyfin Console
This is an open-source user interface made specifically for managing jellyfin and related services from a single, unified web management console. 

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
