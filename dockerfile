FROM lipanski/docker-static-website@sha256:2b9b48d80d4c5c1b5c9c4a8e7d6f5e4d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f

# Copy the built application files
COPY dist/ .

# Remove any release directory to prevent including old zip files

# Create httpd.conf for SPA routing and any needed configuration
COPY docker/httpd.conf .

HEALTHCHECK CMD wget -qO- http://localhost:3000/ || exit 1

# The base image already exposes port 3000 and runs the httpd server
# No additional configuration needed
