FROM node:18-alpine

WORKDIR /app

# Install required packages
RUN apk add --no-cache curl python3 make g++ bash

# Copy package files
COPY search/package*.json ./

# Install dependencies (use npm install if no package-lock.json exists)
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# Copy indexer code
COPY search/ ./

# Make the indexer executable
RUN chmod +x indexer.js

# Install wait-for-it script
RUN wget https://raw.githubusercontent.com/vishnubob/wait-for-it/master/wait-for-it.sh -O /usr/local/bin/wait-for-it.sh && \
    chmod +x /usr/local/bin/wait-for-it.sh

# Default command
CMD ["sh", "-c", "wait-for-it.sh elasticsearch:9200 -- node indexer.js"] 