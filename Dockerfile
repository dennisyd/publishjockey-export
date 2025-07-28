FROM ubuntu:22.04

# Install Node.js and LaTeX with proper fonts
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

# Install Pandoc 3.6.4 (overrides the system pandoc for our application)
RUN PANDOC_VERSION="3.6.4" && \
    CACHE_DIR="/root/.cache" && \
    PANDOC_BINARY="$CACHE_DIR/pandoc-${PANDOC_VERSION}" && \
    mkdir -p "$CACHE_DIR" && \
    TEMP_DIR=$(mktemp -d) && \
    cd "$TEMP_DIR" && \
    TARBALL="pandoc-${PANDOC_VERSION}-linux-amd64.tar.gz" && \
    curl -L "https://github.com/jgm/pandoc/releases/download/${PANDOC_VERSION}/${TARBALL}" -o "${TARBALL}" && \
    tar -xzf "${TARBALL}" && \
    EXTRACTED_DIR="pandoc-${PANDOC_VERSION}" && \
    cp "${EXTRACTED_DIR}/bin/pandoc" "$PANDOC_BINARY" && \
    chmod +x "$PANDOC_BINARY" && \
    cd / && \
    rm -rf "$TEMP_DIR" && \
    echo "Pandoc 3.6.4 installed successfully" && \
    $PANDOC_BINARY --version

# Install Node.js 18
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs

# Refresh font cache and verify fonts are available
RUN fc-cache -f -v && \
    echo "=== AVAILABLE SERIF FONTS ===" && \
    fc-list | grep -i "liberation serif" || true && \
    fc-list | grep -i "dejavu serif" || true && \
    fc-list | grep -i "times" || true && \
    echo "=== END FONT LIST ==="

# Verify everything is installed
RUN echo "=== INSTALLATION VERIFICATION ===" && \
    node --version && \
    npm --version && \
    echo "System Pandoc:" && pandoc --version && \
    echo "Pandoc 3.6.4:" && /root/.cache/pandoc-3.6.4 --version && \
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