FROM ubuntu:22.04

# Install Node.js and LaTeX with proper fonts
# Yancy Dennis
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
    fonts-liberation \
    fonts-liberation2 \
    fonts-dejavu \
    fonts-dejavu-core \
    fonts-dejavu-extra \
    fonts-noto \
    fonts-noto-core \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 18
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs

# Refresh font cache and verify fonts are available
RUN fc-cache -f -v && \
    echo "=== AVAILABLE SERIF FONTS ===" && \
    fc-list | grep -i "liberation serif" && \
    fc-list | grep -i "dejavu serif" && \
    fc-list | grep -i "times" && \
    echo "=== END FONT LIST ==="

# Verify everything is installed
RUN echo "=== INSTALLATION VERIFICATION ===" && \
    node --version && \
    npm --version && \
    pandoc --version && \
    pdflatex --version && \
    echo "=== LaTeX ENGINES AVAILABLE ===" && \
    which pdflatex && \
    which xelatex && \
    echo "=== FONT VERIFICATION ===" && \
    fc-list | wc -l && echo "total fonts installed" && \
    echo "=== VERIFICATION COMPLETE ==="

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3002

CMD ["node", "server.js"]