#!/bin/sh

# Create a runtime environment file
echo "window.env = {" > /usr/share/nginx/html/env-config.js
echo "VITE_HOST_IP: \"${HOST_IP}\"," >> /usr/share/nginx/html/env-config.js
echo "};" >> /usr/share/nginx/html/env-config.js

# Start Nginx
nginx -g "daemon off;"
