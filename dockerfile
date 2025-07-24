FROM node:18

# Install LaTeX packages - more comprehensive installation
RUN apt-get update && apt-get install -y \
    texlive-full \
    pandoc \
    fonts-liberation \
    fonts-dejavu-core \
    fontconfig \
    && rm -rf /var/lib/apt/lists/*

# Alternative minimal approach (comment out texlive-full above and use this instead):
# RUN apt-get update && apt-get install -y \
#     texlive-latex-base \
#     texlive-latex-recommended \
#     texlive-latex-extra \
#     texlive-fonts-recommended \
#     texlive-fonts-extra \
#     texlive-xetex \
#     texlive-luatex \
#     pandoc \
#     fonts-liberation \
#     fonts-dejavu-core \
#     fontconfig \
#     && rm -rf /var/lib/apt/lists/*

# Verify XeLaTeX installation
RUN which xelatex && xelatex --version

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