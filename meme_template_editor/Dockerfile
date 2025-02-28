FROM node:22-slim

WORKDIR /app

# Install Python, build essentials, and PostgreSQL development files for node-gyp
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    postgresql-client \
    libpq-dev \
    && ln -sf /usr/bin/python3 /usr/bin/python

# Copy package.json
COPY package.json ./

# Install dependencies with legacy-peer-deps to handle dependency conflicts
RUN npm install --legacy-peer-deps

# Copy the rest of the application
COPY . .

# Build the application
RUN npm run build

# Expose the port the app will run on
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
