FROM node:22-slim

# Install system libraries required by Chromium/headless Puppeteer and FFmpeg
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxrandr2 \
    libxshmfence1 \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Environment variables
ENV NODE_ENV=production
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Copy package management files for layer caching
COPY package*.json ./

# Install production dependencies skipping postinstall scripts, then install ffmpeg-static binary explicitly
RUN npm install --omit=dev --ignore-scripts && (node node_modules/ffmpeg-static/install.js || true)

# Copy remaining application source code
COPY . .

# Ensure output and uploads runtime directories exist
RUN mkdir -p output uploads

# Expose Cloud Run default port
EXPOSE 8080

# Start application
CMD ["npm", "start"]
