FROM node:18-alpine

# Install Chromium and dependencies for Puppeteer
RUN apk add --no-cache \
      chromium \
      nss \
      freetype \
      harfbuzz \
      ca-certificates \
      ttf-freefont \
      nodejs \
      yarn \
      curl

# Tell Puppeteer to skip installing Chrome v. download and use the installed package
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev for testing)
RUN npm install

# Copy source code
COPY . .

# Create logs directory
RUN mkdir -p logs public/images

# Expose port
EXPOSE 3000

# Default command (can be overridden in docker-compose)
CMD ["npm", "start"]
