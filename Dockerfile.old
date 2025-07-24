FROM ubuntu:22.04

# Install Node.js and LaTeX
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y \
    curl \
    gnupg \
    texlive-latex-base \
    texlive-latex-recommended \
    texlive-latex-extra \
    texlive-fonts-recommended \
    texlive-fonts-extra \
    texlive-xetex \
    pandoc \
    fontconfig \
    lmodern \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 18
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs

# Verify everything is installed
RUN echo "=== INSTALLATION VERIFICATION ===" && \
    node --version && \
    npm --version && \
    pandoc --version && \
    pdflatex --version && \
    echo "=== LaTeX ENGINES AVAILABLE ===" && \
    which pdflatex && \
    which xelatex && \
    echo "=== VERIFICATION COMPLETE ==="

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3002

CMD ["node", "server.js"]
