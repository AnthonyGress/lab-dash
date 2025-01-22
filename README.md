# Jellyfin Console
This is an open-source user interface made specifically for managing jellyfin and related services from a single, unified web management console. 
<img width="1227" alt="jellyfin-console-desktop" src="https://github.com/user-attachments/assets/18cb497b-8295-488e-95a1-4b7aef0ded56" />
<img width="391" alt="jellyfin-console-mobile" src="https://github.com/user-attachments/assets/1bcdbb4e-c7ae-44a9-8230-37860000f124" />


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

# Disclaimer
This code is provided for informational and educational purposes only. I am not responsible for the actions performed by any users of this code and I am not associated with any of the services/applications mentioned in this project.
