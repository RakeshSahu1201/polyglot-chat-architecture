FROM node:24-alpine

WORKDIR /app

# Cache package installation
COPY package*.json ./
RUN npm install --production

# Copy application source
COPY . .

# Create media upload directory
RUN mkdir -p /app/media

# Expose port
EXPOSE 5000

CMD ["npm", "start"]
