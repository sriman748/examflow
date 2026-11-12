FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application source code
COPY . .

# Expose server port
EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

# Run migration & start server
CMD ["sh", "-c", "node src/migrate.js && node src/seed.js && node src/server.js"]
