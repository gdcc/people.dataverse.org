#!/bin/sh
docker run -p 8080:80 \
  -v ./nginx.conf:/etc/nginx/nginx.conf \
  -v ./404.html:/usr/share/nginx/html/404.html \
  -v "$(pwd)/../:/usr/share/nginx/html" \
  nginx:latest
