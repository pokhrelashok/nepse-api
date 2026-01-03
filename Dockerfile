FROM oven/bun:1.3.5-alpine

# Install Chromium and dependencies for Puppeteer
RUN apk add --no-cache \
      chromium \
      nss \
      freetype \
      harfbuzz \
      ca-certificates \
      ttf-freefont \
      curl

# Tell Puppeteer to skip installing Chrome and use the installed package
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

WORKDIR /app

# Copy package files
COPY package.json bun.lockb* ./

# Install dependencies with Bun
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Build frontend
RUN cd frontend && bun install && bun run build

# Create logs directory
RUN mkdir -p logs public/images

# Expose port
EXPOSE 3000

# Default command (can be overridden in docker-compose)
CMD ["bun", "run", "start"]
