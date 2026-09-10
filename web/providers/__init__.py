"""Repo provider factory and URL parsing."""
import re

from .base import BaseProvider, RepoError, RepoRef

_ADO_DEV = re.compile(r"^https?://(?:[^@/]+@)?dev\.azure\.com/([^/]+)/([^/]+)/_git/([^/?#]+)/?$", re.I)
_ADO_VSTS = re.compile(r"^https?://([^./]+)\.visualstudio\.com/([^/]+)/_git/([^/?#]+)/?$", re.I)
_GITHUB = re.compile(r"^https?://(?:www\.)?github\.com/([^/]+)/([^/?#]+?)(?:\.git)?/?$", re.I)


def parse_repo_url(url: str) -> RepoRef:
    """Derive provider and coordinates from a pasted repo URL."""
    url = (url or "").strip()
    m = _ADO_DEV.match(url) or _ADO_VSTS.match(url)
    if m:
        org, project, repo = m.groups()
        return RepoRef("ado", repo, org=org, project=project)
    m = _GITHUB.match(url)
    if m:
        owner, repo = m.groups()
        return RepoRef("github", repo, owner=owner)
    raise ValueError(
        "Unrecognized repo URL. Use https://dev.azure.com/{org}/{project}/_git/{repo} "
        "or https://github.com/{owner}/{repo}"
    )


def get_provider(ref: RepoRef, token: str, scheme: str = "basic") -> BaseProvider:
    """Instantiate the provider matching ref.provider. scheme: 'basic' (PAT) or 'bearer'."""
    if ref.provider == "ado":
        from .azure_devops import AzureDevOpsProvider
        return AzureDevOpsProvider(ref, token, scheme)
    if ref.provider == "github":
        from .github import GitHubProvider
        return GitHubProvider(ref, token)   # GitHub always sends the token as Bearer
    raise ValueError(f"Unknown provider '{ref.provider}'")


__all__ = ["BaseProvider", "RepoError", "RepoRef", "parse_repo_url", "get_provider"]
