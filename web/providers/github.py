"""GitHub REST API provider (Contents API)."""
import base64
from typing import Dict, List, Optional

import requests

from .base import BaseProvider, RepoError, RepoRef

TIMEOUT = (5, 30)


def _gh_path(path: str) -> str:
    """GitHub content paths have no leading slash."""
    return (path or "").strip().strip("/")


class GitHubProvider(BaseProvider):
    name = "GitHub"

    def __init__(self, ref: RepoRef, token: str):
        super().__init__(ref, token)
        self.base = f"https://api.github.com/repos/{ref.owner}/{ref.repo}"
        self.session.headers.update({
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        })

    # -- helpers -----------------------------------------------------------

    def _get(self, url: str, params: Optional[Dict[str, str]] = None) -> requests.Response:
        resp = self.session.get(url, params=params or {}, timeout=TIMEOUT)
        self._raise_for(resp)
        return resp

    def _contents_url(self, path: str) -> str:
        return f"{self.base}/contents/{_gh_path(path)}".rstrip("/")

    def _file_sha(self, path: str, branch: str) -> Optional[str]:
        """Blob sha of a file or None when it does not exist."""
        resp = self.session.get(self._contents_url(path), params={"ref": branch}, timeout=TIMEOUT)
        if resp.status_code == 404:
            return None
        self._raise_for(resp)
        data = resp.json()
        if isinstance(data, list):
            raise RepoError(404, "Repo, branch or path not found")
        return data.get("sha")

    def _write(self, method: str, path: str, body: Dict) -> requests.Response:
        resp = self.session.request(method, self._contents_url(path), json=body, timeout=TIMEOUT)
        if resp.status_code in (409, 422):
            raise RepoError(409, "File changed on the server, pull again")
        self._raise_for(resp)
        return resp

    # -- interface ---------------------------------------------------------

    def ping(self) -> Dict[str, str]:
        data = self._get(self.base).json()
        return {"name": data.get("name", self.ref.repo),
                "default_branch": data.get("default_branch", "main")}

    def list_branches(self) -> List[str]:
        data = self._get(f"{self.base}/branches", {"per_page": "100"}).json()
        return [b["name"] for b in data]

    def list_dir(self, path: str, branch: str, recursive: bool = False) -> List[Dict[str, str]]:
        prefix = _gh_path(path)
        if recursive:
            data = self._get(f"{self.base}/git/trees/{branch}", {"recursive": "1"}).json()
            out = []
            for node in data.get("tree", []):
                if prefix and not node["path"].startswith(prefix + "/"):
                    continue
                out.append({"path": node["path"], "type": "dir" if node["type"] == "tree" else "file",
                            "version": node.get("sha", "")})
            return out
        data = self._get(self._contents_url(prefix), {"ref": branch}).json()
        if not isinstance(data, list):
            raise RepoError(404, "Repo, branch or path not found")
        return [{"path": n["path"], "type": "dir" if n["type"] == "dir" else "file",
                 "version": n.get("sha", "")} for n in data]

    def get_file(self, path: str, branch: str) -> Dict[str, str]:
        data = self._get(self._contents_url(path), {"ref": branch}).json()
        if isinstance(data, list):
            raise RepoError(404, "Repo, branch or path not found")
        sha = data.get("sha", "")
        if data.get("encoding") == "base64" and data.get("content"):
            content = base64.b64decode(data["content"]).decode("utf-8")
        else:  # large files come back without inline content
            blob = self._get(f"{self.base}/git/blobs/{sha}").json()
            content = base64.b64decode(blob.get("content", "")).decode("utf-8")
        return {"content": content, "version": sha}

    def put_file(self, path: str, content: str, message: str, branch: str,
                 base_version: Optional[str]) -> Dict[str, str]:
        if base_version is None and self._file_sha(path, branch) is not None:
            raise RepoError(409, "File already exists on the server, pull again")
        body = {"message": message, "branch": branch,
                "content": base64.b64encode(content.encode("utf-8")).decode("ascii")}
        if base_version:
            body["sha"] = base_version
        data = self._write("PUT", path, body).json()
        return {"version": data.get("content", {}).get("sha", ""),
                "commit": data.get("commit", {}).get("sha", "")}

    def delete_file(self, path: str, message: str, branch: str,
                    base_version: Optional[str]) -> Dict[str, str]:
        sha = base_version or self._file_sha(path, branch)
        if not sha:
            raise RepoError(404, "Repo, branch or path not found")
        data = self._write("DELETE", path, {"message": message, "branch": branch, "sha": sha}).json()
        return {"commit": data.get("commit", {}).get("sha", "")}
