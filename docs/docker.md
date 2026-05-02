# Docker Documentation

LLMChef ships as a static web application. The Docker setup serves the built app with a minimal BusyBox httpd image and does not add bundled backend services.

## Quick Start

```bash
npm run build
docker build -t llmchef .
docker run -d -p 8080:3000 llmchef
```

Open `http://localhost:8080`.

## Docker Compose

```bash
docker-compose up -d
docker-compose logs -f llmchef
docker-compose down
```

Create a `.env` file when you want to change the exposed port:

```bash
LLMCHEF_PORT=8080
```

| Variable | Default | Description |
|----------|---------|-------------|
| `LLMCHEF_PORT` | 8080 | External port for LLMChef |

## Service

The application runs on [lipanski/docker-static-website](https://github.com/lipanski/docker-static-website).

**Features:**
- Static app hosting
- SPA routing support
- Small image size
- Fast startup time

## Language-Specific Images

The builder script can create optimized images for language-specific builds.

```bash
bin/builder --release v1.0.0 --docker-repo myuser/llmchef
```

Example outputs:

- `myuser/llmchef:v1.0.0`
- `myuser/llmchef:latest`
- `myuser/llmchef:v1.0.0-fr`
- `myuser/llmchef:v1.0.0-de`
- `myuser/llmchef:v1.0.0-es`

## Custom Compose

```yaml
version: '3.8'

services:
  llmchef:
    image: myuser/llmchef:v1.0.0
    ports:
      - "8080:3000"
    restart: unless-stopped
```

## Health Checks

```bash
curl http://localhost:8080
docker-compose ps
```

## Troubleshooting

**Container will not start:**

```bash
docker-compose logs llmchef
docker-compose ps
```

**Port conflict:**

```bash
echo "LLMCHEF_PORT=8081" >> .env
docker-compose down
docker-compose up -d
```

## Security

For production:

- Use specific image tags.
- Run the container as a non-root user where possible.
- Drop unused Linux capabilities.
- Keep secrets outside the static app bundle.
- Configure any external MCP endpoints in the app settings, not in the container image.
