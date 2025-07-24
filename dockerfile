# Use a base image that already has LaTeX
FROM ubuntu:22.04

# Install Node.js and LaTeX in one go
RUN apt-get update && apt-get install -y \
    curl \
    texlive-full \
    pandoc \
    && curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Verify installations
RUN node --version && npm --version
RUN pdflatex --version && xelatex --version && pandoc --version

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Expose port
EXPOSE 3002

# Start the app
CMD ["node", "server.js"]