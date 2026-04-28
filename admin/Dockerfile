# =============================================================================
# RecrutiTN Admin Panel - Angular Production Build
# =============================================================================
# Multi-stage build: Node.js build → Nginx serve
# Optimized for: Recruiter/Admin web interface
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Build Angular Application
# -----------------------------------------------------------------------------
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Install dependencies first (better caching)
COPY package*.json ./
RUN npm ci --legacy-peer-deps

# Copy source and build
COPY . .

# Production build with optimization
RUN npm run build -- --configuration=production

# -----------------------------------------------------------------------------
# Stage 2: Production Server (Nginx)
# -----------------------------------------------------------------------------
FROM nginx:1.25-alpine-slim

# Security: Remove default nginx user and create custom
RUN rm -rf /etc/nginx/conf.d/default.conf && \
    addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built Angular app from builder stage
COPY --from=builder /app/dist/admin/browser /usr/share/nginx/html

# Set proper permissions
RUN chown -R appuser:appgroup /usr/share/nginx/html && \
    chown -R appuser:appgroup /var/cache/nginx && \
    chown -R appuser:appgroup /var/log/nginx && \
    chown -R appuser:appgroup /etc/nginx/conf.d && \
    touch /var/run/nginx.pid && \
    chown -R appuser:appgroup /var/run/nginx.pid

# Security headers and optimizations
RUN sed -i 's/server_tokens on/server_tokens off/' /etc/nginx/nginx.conf

# Switch to non-root user
USER appuser

# -----------------------------------------------------------------------------
# Health Check
# -----------------------------------------------------------------------------
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1

# -----------------------------------------------------------------------------
# Expose & Run
# -----------------------------------------------------------------------------
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
