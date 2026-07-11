FROM lipanski/docker-static-website@sha256:66a530684a934a9b94f65a90f286cba291a7daf4dd7d55dcc17f217915056cd5

# Copy the built application files
COPY dist/ .

# Remove any release directory to prevent including old zip files

# Create httpd.conf for SPA routing and any needed configuration
COPY docker/httpd.conf .

HEALTHCHECK CMD wget -qO- http://localhost:3000/ || exit 1

# The base image already exposes port 3000 and runs the httpd server
# No additional configuration needed
