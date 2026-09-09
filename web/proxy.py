"""Proxy blueprint: send a request on behalf of the browser and return the full result."""
import logging
import os
from typing import Any, Dict, List, Optional
from urllib.parse import urlsplit, urlunsplit

import requests
import urllib3
from flask import Blueprint, jsonify, request

proxy_bp = Blueprint("proxy", __name__)
log = logging.getLogger(__name__)

LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1", "[::1]"}
HOP_BY_HOP = {"transfer-encoding", "content-encoding", "connection"}
DEFAULT_TIMEOUT = 30
_warned_insecure = False


def _in_container() -> bool:
    return os.path.exists("/.dockerenv") or os.path.exists("/run/.containerenv")


def _default_host_aliases() -> str:
    """Inside a container, localhost means the container; try the usual host aliases instead."""
    return "host.containers.internal,host.docker.internal" if _in_container() else ""


# Comma-separated list of hosts to try, in order, when the target is localhost.
HOST_ALIASES: List[str] = [a.strip() for a in os.environ.get("HOST_ALIAS", _default_host_aliases()).split(",") if a.strip()]
log.info("proxy: localhost rewrite %s", f"-> {', '.join(HOST_ALIASES)}" if HOST_ALIASES else "disabled")


def is_local_target(url: str) -> bool:
    return (urlsplit(url).hostname or "").lower() in LOCAL_HOSTS


def rewrite_local_host(url: str, alias: Optional[str] = None) -> str:
    """Swap a localhost target for a host alias, keeping scheme and port."""
    alias = alias or (HOST_ALIASES[0] if HOST_ALIASES else "")
    if not alias or not is_local_target(url):
        return url
    parts = urlsplit(url)
    netloc = alias + (f":{parts.port}" if parts.port else "")
    if parts.username:
        cred = parts.username + (f":{parts.password}" if parts.password else "")
        netloc = f"{cred}@{netloc}"
    return urlunsplit((parts.scheme, netloc, parts.path, parts.query, parts.fragment))


def _candidate_urls(api_url: str) -> List[str]:
    """The URLs to try in order: rewritten aliases for localhost targets, else the URL itself."""
    if HOST_ALIASES and is_local_target(api_url):
        # Move the alias that worked last time to the front.
        return [rewrite_local_host(api_url, a) for a in HOST_ALIASES]
    return [api_url]


def _remember_working_alias(url: str) -> None:
    host = urlsplit(url).hostname or ""
    if host in HOST_ALIASES and HOST_ALIASES[0] != host:
        HOST_ALIASES.remove(host)
        HOST_ALIASES.insert(0, host)


def _unreachable_message(api_url: str) -> str:
    port = urlsplit(api_url).port or "the default port"
    if _in_container():
        return (
            f"Could not reach {urlsplit(api_url).hostname}:{port} from inside the container "
            f"(tried {', '.join(HOST_ALIASES)}). The container can only reach services on your machine that "
            f"listen on all interfaces and are allowed through the firewall; services bound to localhost only "
            f"(IIS Express, most dev servers) are not reachable from Podman on Windows. Run the app from source "
            f"for local APIs: python -m web.app"
        )
    return f"Could not connect to {urlsplit(api_url).hostname}:{port}. Is the service running?"


def _parse_content(resp: requests.Response) -> Any:
    """JSON when the content type says so, otherwise text."""
    ctype = resp.headers.get("Content-Type", "")
    if "application/json" in ctype.lower() or ctype.lower().endswith("+json"):
        try:
            return resp.json()
        except ValueError:
            pass
    return resp.text


def _response_headers(resp: requests.Response) -> Dict[str, str]:
    return {k: v for k, v in resp.headers.items() if k.lower() not in HOP_BY_HOP}


def _disable_insecure_warning() -> None:
    global _warned_insecure
    if not _warned_insecure:
        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
        _warned_insecure = True


@proxy_bp.route("/proxy_request", methods=["POST"])
def proxy_request():
    """Forward the described request and wrap the upstream result in a 200 envelope."""
    data = request.get_json(silent=True) or {}
    api_url = (data.get("apiUrl") or "").strip()
    method = (data.get("httpMethod") or "GET").upper()
    headers = data.get("headers") or {}
    body = data.get("body")
    raw_body: Optional[str] = data.get("rawBody")
    verify_tls = data.get("verifyTls", True) is not False
    try:
        timeout = float(data.get("timeout") or DEFAULT_TIMEOUT)
    except (TypeError, ValueError):
        timeout = DEFAULT_TIMEOUT

    if not api_url:
        return jsonify({"error": "apiUrl is required"}), 400

    if not verify_tls:
        _disable_insecure_warning()

    kwargs: Dict[str, Any] = {"headers": headers, "verify": verify_tls, "timeout": (5, timeout)}
    if raw_body is not None:
        kwargs["data"] = raw_body.encode("utf-8") if isinstance(raw_body, str) else raw_body
    elif body is not None:
        kwargs["json"] = body

    candidates = _candidate_urls(api_url)
    resp = None
    for target in candidates:
        try:
            resp = requests.request(method, target, **kwargs)
            _remember_working_alias(target)
            break
        except requests.exceptions.SSLError as exc:
            return jsonify({"error": f"TLS error: {exc}. Try 'skip TLS verify' for self-signed certs."}), 502
        except requests.exceptions.ConnectionError as exc:
            last_error = exc
            continue  # try the next alias, if any
        except requests.exceptions.RequestException as exc:
            return jsonify({"error": f"{exc.__class__.__name__}: {exc}"}), 502

    if resp is None:
        detail = f"{last_error.__class__.__name__}: {str(last_error)[:200]}"
        message = _unreachable_message(api_url) if len(candidates) > 1 or is_local_target(api_url) else detail
        return jsonify({"error": message, "detail": detail}), 502

    return jsonify({
        "status_code": resp.status_code,
        "status_text": resp.reason or "",
        "headers": _response_headers(resp),
        "content_type": resp.headers.get("Content-Type", ""),
        "content": _parse_content(resp),
        "elapsed_ms": int(resp.elapsed.total_seconds() * 1000),
        "effective_url": resp.url,
        "requested_url": api_url,
    }), 200
