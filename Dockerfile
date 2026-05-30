# TravelAgencyWeb Frontend - Vite build -> Nginx static serve
FROM node:20-alpine AS build
WORKDIR /app
ARG VITE_API_URL=https://api.travelagencyweb.com/api
ARG VITE_APP_DOMAIN=travelagencyweb.com
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_APP_DOMAIN=$VITE_APP_DOMAIN
COPY package.json package-lock.json* bun.lockb* ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM nginx:alpine AS runtime
RUN rm /etc/nginx/conf.d/default.conf
COPY app/frontend.nginx.conf /etc/nginx/conf.d/app.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
CMD ["nginx","-g","daemon off;"]
