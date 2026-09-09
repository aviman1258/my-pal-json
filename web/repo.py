"""Repo blueprint: file-level access to a git host on behalf of the browser."""
from typing import Tuple

import requests
from flask import Blueprint, jsonify, request

from .providers import BaseProvider, RepoError, get_provider, parse_repo_url

repo_bp = Blueprint("repo_bp", __name__, url_prefix="/repo")

TOKEN_HEADER = "X-Repo-Token"


def _context() -> Tuple[BaseProvider, str]:
    """Build a provider from the request and resolve the branch."""
    token = request.headers.get(TOKEN_HEADER, "").strip()
    if not token:
        raise RepoError(401, f"Missing {TOKEN_HEADER} header")
    try:
        ref = parse_repo_url(request.args.get("repo", ""))
    except ValueError as exc:
        raise RepoError(400, str(exc))
    provider = get_provider(ref, token)
    branch = request.args.get("branch", "").strip() or provider.ping()["default_branch"]
    return provider, branch


def _safe_path(required: bool = True) -> str:
    """Read and validate the path query parameter."""
    path = request.args.get("path", "").strip()
    if ".." in path.replace("\\", "/").split("/"):
        raise RepoError(400, "Path may not contain '..'")
    if required and not path.strip("/"):
        raise RepoError(400, "A file path is required")
    return path or "/"


def _json_body() -> dict:
    return request.get_json(silent=True) or {}


@repo_bp.errorhandler(RepoError)
def _repo_error(exc: RepoError):
    return jsonify({"error": exc.message}), exc.status


@repo_bp.errorhandler(requests.RequestException)
def _network_error(exc: requests.RequestException):
    return jsonify({"error": f"Could not reach the repo host: {exc.__class__.__name__}"}), 502


@repo_bp.route("/ping", methods=["GET"])
def ping():
    """Validate the token and describe the repo."""
    token = request.headers.get(TOKEN_HEADER, "").strip()
    if not token:
        raise RepoError(401, f"Missing {TOKEN_HEADER} header")
    try:
        ref = parse_repo_url(request.args.get("repo", ""))
    except ValueError as exc:
        raise RepoError(400, str(exc))
    provider = get_provider(ref, token)
    info = provider.ping()
    return jsonify({
        "provider": ref.provider,
        "repo": ref.to_dict(),
        "name": info["name"],
        "default_branch": info["default_branch"],
        "branches": provider.list_branches(),
    })


@repo_bp.route("/tree", methods=["GET"])
def tree():
    """List a folder."""
    provider, branch = _context()
    path = _safe_path(required=False)
    recursive = request.args.get("recursive", "0") in ("1", "true", "yes")
    return jsonify({"branch": branch, "items": provider.list_dir(path, branch, recursive)})


@repo_bp.route("/file", methods=["GET"])
def get_file():
    """Read a file."""
    provider, branch = _context()
    result = provider.get_file(_safe_path(), branch)
    result["branch"] = branch
    return jsonify(result)


@repo_bp.route("/file", methods=["PUT"])
def put_file():
    """Create or update a file."""
    provider, branch = _context()
    body = _json_body()
    if "content" not in body:
        raise RepoError(400, "Body must include 'content'")
    result = provider.put_file(
        _safe_path(), body["content"],
        body.get("message") or "Update via My Pal JSON",
        branch, body.get("base_version"),
    )
    result["branch"] = branch
    return jsonify(result)


@repo_bp.route("/file", methods=["DELETE"])
def delete_file():
    """Delete a file."""
    provider, branch = _context()
    body = _json_body()
    result = provider.delete_file(
        _safe_path(), body.get("message") or "Delete via My Pal JSON",
        branch, body.get("base_version"),
    )
    result["branch"] = branch
    return jsonify(result)
