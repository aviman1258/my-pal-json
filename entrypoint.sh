#!/bin/sh
# Trust any extra root certificates mounted at /certs (corporate TLS inspection),
# then start the app. Python picks them up through the system store via truststore.
set -e

if ls /certs/*.crt /certs/*.pem >/dev/null 2>&1; then
    mkdir -p /usr/local/share/ca-certificates/extra
    for f in /certs/*.crt /certs/*.pem; do
        [ -f "$f" ] && cp "$f" "/usr/local/share/ca-certificates/extra/$(basename "$f" | sed 's/\.pem$/.crt/')"
    done
    update-ca-certificates >/dev/null 2>&1 || echo "warning: update-ca-certificates failed" >&2
    echo "Added $(ls /certs/*.crt /certs/*.pem 2>/dev/null | wc -l) extra CA certificate(s) from /certs"
fi

echo "My Pal JSON starting on :5000 (localhost rewrite -> ${HOST_ALIAS:-disabled})"
exec gunicorn -w "${WORKERS:-2}" -b 0.0.0.0:5000 web.app:app
