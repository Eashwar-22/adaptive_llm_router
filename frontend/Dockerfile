FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Build the Next.js app
RUN npm run build

# Start the Next.js app
CMD ["npm", "run", "start"]
