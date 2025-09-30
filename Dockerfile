# Stage 1: Build the React app with Node.js 20.x
FROM node:20.12.2-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install dependencies
RUN npm install
# Copy the rest of the application files
COPY . .

# Build the React app for production
RUN npm run build

