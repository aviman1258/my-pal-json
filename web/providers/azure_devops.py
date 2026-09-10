"""Azure DevOps Git REST API provider (api-version 7.1)."""
from typing import Dict, List, Optional

import requests
from requests.auth import HTTPBasicAuth

from .base import BaseProvider, RepoError, RepoRef

API_VERSION = "7.1"
TIMEOUT = (5, 30)


def _ado_path(path: str) -> str:
    """ADO item paths always start with a slash."""
    path = (path or "/").strip()
    return path if path.startswith("/") else "/" + path


class AzureDevOpsProvider(BaseProvider):
    name = "Azure DevOps"

    def __init__(self, ref: RepoRef, token: str, scheme: str = "basic"):
        super().__init__(ref, token, scheme)
        self.base = (f"https://dev.azure.com/{ref.org}/{ref.project}"
                     f"/_apis/git/repositories/{ref.repo}")
        if scheme == "bearer":
            self.session.headers["Authorization"] = f"Bearer {token}"   # Entra / OAuth access token
        else:
            self.session.auth = HTTPBasicAuth("", token)                # PAT
        self.session.headers.update({"Accept": "application/json"})

    # -- helpers -----------------------------------------------------------

    def _get(self, url: str, params: Dict[str, str]) -> requests.Response:
        params = dict(params, **{"api-version": API_VERSION})
        resp = self.session.get(url, params=params, timeout=TIMEOUT)
        self._raise_for(resp)
        return resp

    def _version_params(self, branch: str) -> Dict[str, str]:
        return {"versionDescriptor.version": branch, "versionDescriptor.versionType": "branch"}

    def _branch_tip(self, branch: str) -> str:
        """Commit id at the tip of a branch."""
        resp = self._get(f"{self.base}/refs", {"filter": f"heads/{branch}"})
        refs = [r for r in resp.json().get("value", []) if r.get("name") == f"refs/heads/{branch}"]
        if not refs:
            raise RepoError(404, "Repo, branch or path not found")
        return refs[0]["objectId"]

    def _item_meta(self, path: str, branch: str) -> Optional[Dict]:
        """Item metadata (no content) or None when the path does not exist."""
        params = dict(self._version_params(branch), path=_ado_path(path), **{"api-version": API_VERSION})
        resp = self.session.get(f"{self.base}/items", params=params, timeout=TIMEOUT)
        if resp.status_code == 404:
            return None
        self._raise_for(resp)
        return resp.json()

    def _push(self, branch: str, message: str, change: Dict) -> Dict[str, str]:
        """Push a single-change commit onto the branch tip."""
        tip = self._branch_tip(branch)
        body = {
            "refUpdates": [{"name": f"refs/heads/{branch}", "oldObjectId": tip}],
            "commits": [{"comment": message, "changes": [change]}],
        }
        resp = self.session.post(f"{self.base}/pushes", params={"api-version": API_VERSION},
                                 json=body, timeout=TIMEOUT)
        if resp.status_code == 400 and ("TF401028" in resp.text or "oldObjectId" in resp.text):
            raise RepoError(409, "File changed on the server, pull again")
        self._raise_for(resp)
        commits = resp.json().get("commits", [])
        return {"commit": commits[0]["commitId"] if commits else ""}

    # -- interface ---------------------------------------------------------

    def ping(self) -> Dict[str, str]:
        data = self._get(self.base, {}).json()
        default = (data.get("defaultBranch") or "refs/heads/main").replace("refs/heads/", "", 1)
        return {"name": data.get("name", self.ref.repo), "default_branch": default}

    def list_branches(self) -> List[str]:
        data = self._get(f"{self.base}/refs", {"filter": "heads/"}).json()
        return [r["name"].replace("refs/heads/", "", 1) for r in data.get("value", [])]

    def list_dir(self, path: str, branch: str, recursive: bool = False) -> List[Dict[str, str]]:
        scope = _ado_path(path)
        params = dict(self._version_params(branch), scopePath=scope,
                      recursionLevel="Full" if recursive else "OneLevel")
        data = self._get(f"{self.base}/items", params).json()
        out = []
        for item in data.get("value", []):
            item_path = item.get("path", "")
            if item_path.rstrip("/") == scope.rstrip("/"):
                continue  # the folder itself
            is_dir = bool(item.get("isFolder")) or item.get("gitObjectType") == "tree"
            out.append({"path": item_path, "type": "dir" if is_dir else "file",
                        "version": item.get("objectId", "")})
        return out

    def get_file(self, path: str, branch: str) -> Dict[str, str]:
        params = dict(self._version_params(branch), path=_ado_path(path),
                      includeContent="true", **{"$format": "json"})
        data = self._get(f"{self.base}/items", params).json()
        if data.get("isFolder"):
            raise RepoError(404, "Repo, branch or path not found")
        return {"content": data.get("content", ""), "version": data.get("objectId", "")}

    def put_file(self, path: str, content: str, message: str, branch: str,
                 base_version: Optional[str]) -> Dict[str, str]:
        path = _ado_path(path)
        meta = self._item_meta(path, branch)
        if base_version is None:
            if meta is not None:
                raise RepoError(409, "File already exists on the server, pull again")
            change_type = "add"
        else:
            if meta is None or meta.get("objectId") != base_version:
                raise RepoError(409, "File changed on the server, pull again")
            change_type = "edit"
        change = {"changeType": change_type, "item": {"path": path},
                  "newContent": {"content": content, "contentType": "rawtext"}}
        result = self._push(branch, message, change)
        new_meta = self._item_meta(path, branch) or {}
        result["version"] = new_meta.get("objectId", "")
        return result

    def delete_file(self, path: str, message: str, branch: str,
                    base_version: Optional[str]) -> Dict[str, str]:
        path = _ado_path(path)
        meta = self._item_meta(path, branch)
        if meta is None:
            raise RepoError(404, "Repo, branch or path not found")
        if base_version is not None and meta.get("objectId") != base_version:
            raise RepoError(409, "File changed on the server, pull again")
        return self._push(branch, message, {"changeType": "delete", "item": {"path": path}})
