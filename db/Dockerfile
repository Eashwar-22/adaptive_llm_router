FROM postgres:17

# Install build dependencies for pg_semantic_cache and pgvector
RUN apt-get update && apt-get install -y \
    build-essential \
    git \
    postgresql-server-dev-17 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install pgvector
RUN git clone --branch v0.7.0 https://github.com/pgvector/pgvector.git && \
    cd pgvector && \
    make && \
    make install

# Install pg_semantic_cache
RUN git clone https://github.com/pgedge/pg_semantic_cache.git && \
    cd pg_semantic_cache && \
    make clean && \
    make && \
    make install

# Enable extensions on startup
RUN echo "CREATE EXTENSION IF NOT EXISTS vector;" > /docker-entrypoint-initdb.d/init.sql && \
    echo "CREATE EXTENSION IF NOT EXISTS pg_semantic_cache;" >> /docker-entrypoint-initdb.d/init.sql
