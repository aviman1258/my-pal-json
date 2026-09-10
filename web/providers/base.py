"""Provider interface and shared error type for git-hosting backends."""
from typing import Dict, List, Optional

import requests


class RepoError(Exception):
    """Error from a repo provider carrying an HTTP status for the UI."""

    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status
        self.message = message


class RepoRef:
    """Coordinates of a repository plus which provider serves it."""

    def __init__(self, provider: str, repo: str, org: str = "", project: str = "", owner: str = ""):
        self.provider = provider
        self.repo = repo
        self.org = org
        self.project = project
        self.owner = owner

    def __repr__(self) -> str:
        if self.provider == "ado":
            return f"RepoRef(provider='ado', org='{self.org}', project='{self.project}', repo='{self.repo}')"
        return f"RepoRef(provider='github', owner='{self.owner}', repo='{self.repo}')"

    def to_dict(self) -> Dict[str, str]:
        """Plain dict for JSON responses."""
        return {k: v for k, v in vars(self).items() if v}


def map_http_error(resp: requests.Response, provider_name: str) -> RepoError:
    """Translate an upstream HTTP error into a RepoError with a human message."""
    code = resp.status_code
    if code == 401:
        return RepoError(401, "Token rejected or expired")
    if code == 403:
        return RepoError(403, "Not allowed: the token lacks Code (Read & Write) scope, or your account lacks access to this repo")
    if code == 404:
        return RepoError(404, "Repo, branch or path not found")
    if code in (409, 412):
        return RepoError(409, "File changed on the server, pull again")
    snippet = (resp.text or "")[:200].replace("\n", " ")
    return RepoError(502, f"{provider_name} returned {code}: {snippet}")


class BaseProvider:
    """Minimal file-level git operations every provider must implement."""

    name = "base"

    def __init__(self, ref: RepoRef, token: str, scheme: str = "basic"):
        self.ref = ref
        self.token = token
        self.scheme = scheme          # "basic" (PAT) or "bearer" (OAuth / Entra access token)
        self.session = requests.Session()

    def ping(self) -> Dict[str, str]:
        """Validate the token; return {name, default_branch}."""
        raise NotImplementedError

    def list_branches(self) -> List[str]:
        """Return branch names."""
        raise NotImplementedError

    def list_dir(self, path: str, branch: str, recursive: bool = False) -> List[Dict[str, str]]:
        """Return [{path, type: 'file'|'dir', version}] under path."""
        raise NotImplementedError

    def get_file(self, path: str, branch: str) -> Dict[str, str]:
        """Return {content, version} for a file."""
        raise NotImplementedError

    def put_file(self, path: str, content: str, message: str, branch: str,
                 base_version: Optional[str]) -> Dict[str, str]:
        """Create (base_version None) or update a file; return {version, commit}."""
        raise NotImplementedError

    def delete_file(self, path: str, message: str, branch: str,
                    base_version: Optional[str]) -> Dict[str, str]:
        """Delete a file; return {commit}."""
        raise NotImplementedError

    def _raise_for(self, resp: requests.Response) -> None:
        """Raise a RepoError if the upstream response is an error."""
        if resp.status_code >= 400:
            raise map_http_error(resp, self.name)
