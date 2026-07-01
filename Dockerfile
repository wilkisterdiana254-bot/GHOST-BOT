FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package.json ./
RUN npm install --production

# Copy source
COPY . .

# Create session directory
RUN mkdir -p session

EXPOSE 10000

CMD ["node", "index.js"]