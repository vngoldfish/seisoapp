# Build stage
FROM node:20-alpine AS builder
WORKDIR /app

# Declare build arguments
ARG VITE_USE_POSTGRES
ARG VITE_BACKEND_URL

# Set environment variables for the build process
ENV VITE_USE_POSTGRES=$VITE_USE_POSTGRES
ENV VITE_BACKEND_URL=$VITE_BACKEND_URL

COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
