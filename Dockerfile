FROM python:3.12-slim

LABEL org.opencontainers.image.title="My Pal JSON" \
      org.opencontainers.image.description="Local API client with repo-backed Postman collections, request chaining, JSON analysis and model generation" \
      org.opencontainers.image.source="https://github.com/aviman1258/my-pal-json" \
      org.opencontainers.image.version="2.0"

WORKDIR /app

# Dependencies first so code changes don't invalidate the pip layer.
# Behind a TLS-inspecting proxy build with:
#   --build-arg PIP_EXTRA_ARGS="--trusted-host pypi.org --trusted-host files.pythonhosted.org"
ARG PIP_EXTRA_ARGS=""
COPY web/requirements.txt /app/web/requirements.txt
RUN pip install --no-cache-dir $PIP_EXTRA_ARGS -r web/requirements.txt

COPY web /app/web
COPY entrypoint.sh /entrypoint.sh
RUN sed -i 's/\r$//' /entrypoint.sh && chmod +x /entrypoint.sh

# Inside a container "localhost" is the container itself. The proxy rewrites
# localhost targets to these aliases (first one that connects wins) so requests
# reach APIs running on your machine. See README for what works per platform.
ENV HOST_ALIAS=host.containers.internal,host.docker.internal \
    FLASK_DEBUG=0 \
    PYTHONUNBUFFERED=1 \
    WORKERS=2

EXPOSE 5000

ENTRYPOINT ["/entrypoint.sh"]
