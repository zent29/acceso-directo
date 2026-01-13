FROM nginx:alpine

# Limpiar directorio
RUN rm -rf /usr/share/nginx/html/*

# Copiar archivos uno por uno para asegurar que están ahí
COPY index.html /usr/share/nginx/html/index.html
COPY style.css /usr/share/nginx/html/style.css
COPY script.js /usr/share/nginx/html/script.js

# Asegurar permisos de lectura
RUN chmod 644 /usr/share/nginx/html/index.html /usr/share/nginx/html/style.css /usr/share/nginx/html/script.js

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
