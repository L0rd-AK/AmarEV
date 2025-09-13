FROM node:20-alpine as build

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY ../packages/shared/package.json ../packages/shared/

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built app
COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S chargebd -u 1001

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]