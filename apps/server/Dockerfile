FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci --production || npm install --production

# Copy source
COPY . .

# Build (server's build script is a no-op placeholder)
RUN npm run build || true

EXPOSE 3000

CMD ["npm", "start"]
