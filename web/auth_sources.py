"""Where the repo token comes from.

pat    the browser sends a Personal Access Token in X-Repo-Token
azcli  ask the Azure CLI on this machine for an Azure DevOps access token (`az login` session)
gcm    ask Git Credential Manager for the OAuth token it already holds for the host

The last two never leave this machine and need no PAT, which matters when an org
has disabled PAT creation. They only work when the app runs on the developer's
machine (not inside a container, which has neither az nor the user's credentials).
"""
import json
import logging
import os
import shutil
import subprocess
import threading
import time
from typing import Dict, Optional, Tuple

from .providers.base import RepoError, RepoRef

try:
    import msal
except ImportError:  # pragma: no cover
    msal = None

log = logging.getLogger(__name__)

ADO_RESOURCE = "499b84ac-1321-427f-aa17-267ca6975798"   # Azure DevOps app id for Entra tokens
ADO_SCOPES = [f"{ADO_RESOURCE}/.default"]
# Microsoft's public "Azure CLI" client. Tenants that allow `az login` allow this browser flow too
# (it is the same flow); only the device-code flow tends to be blocked by Conditional Access.
MSAL_CLIENT_ID = os.environ.get("MPJ_MSAL_CLIENT_ID", "04b07795-8ddb-461a-bbee-02f9e1bf7b46")
MSAL_AUTHORITY = os.environ.get("MPJ_MSAL_AUTHORITY", "https://login.microsoftonline.com/organizations")
DATA_DIR = os.environ.get("MPJ_DATA_DIR") or os.path.join(os.path.expanduser("~"), ".my-pal-json")

SOURCES = ("pat", "azcli", "gcm", "msal")
_cache: Dict[str, Tuple[str, float]] = {}   # key -> (token, expires_at_epoch)


def _in_container() -> bool:
    return os.path.exists("/.dockerenv") or os.path.exists("/run/.containerenv")


def _run(cmd, stdin: Optional[str] = None, timeout: int = 40) -> subprocess.CompletedProcess:
    env = dict(os.environ, GCM_INTERACTIVE="never", GIT_TERMINAL_PROMPT="0")
    return subprocess.run(cmd, input=stdin, capture_output=True, text=True, timeout=timeout,
                          env=env, shell=(os.name == "nt"))


def _cached(key: str) -> Optional[str]:
    hit = _cache.get(key)
    if hit and hit[1] - 60 > time.time():
        return hit[0]
    return None


# ---------- Azure CLI ----------

def az_available() -> bool:
    return shutil.which("az") is not None


def az_account() -> Optional[str]:
    """Signed-in user, or None."""
    if not az_available():
        return None
    try:
        r = _run(["az", "account", "show", "-o", "json"], timeout=30)
        return json.loads(r.stdout).get("user", {}).get("name") if r.returncode == 0 else None
    except (subprocess.SubprocessError, ValueError):
        return None


def az_token() -> str:
    tok = _cached("azcli")
    if tok:
        return tok
    if not az_available():
        hint = "inside the container there is no Azure CLI; run the app from source" if _in_container() else "install it from https://aka.ms/azcli"
        raise RepoError(503, f"Azure CLI (az) not found on this machine ({hint}).")
    try:
        r = _run(["az", "account", "get-access-token", "--resource", ADO_RESOURCE, "-o", "json"])
    except subprocess.TimeoutExpired:
        raise RepoError(504, "Azure CLI did not answer in time. Try `az login` in a terminal.")
    if r.returncode != 0:
        msg = (r.stderr or r.stdout or "").strip().splitlines()
        raise RepoError(401, f"Azure CLI is not signed in. Run `az login` in a terminal, then retry. ({msg[-1][:160] if msg else 'no details'})")
    data = json.loads(r.stdout)
    token = data["accessToken"]
    expires = data.get("expires_on") or 0
    if not expires:
        try:  # "2026-09-10 10:36:40.000000" local time
            expires = time.mktime(time.strptime(data.get("expiresOn", "")[:19], "%Y-%m-%d %H:%M:%S"))
        except ValueError:
            expires = time.time() + 50 * 60
    _cache["azcli"] = (token, float(expires))
    return token


# ---------- Git Credential Manager ----------

def git_available() -> bool:
    return shutil.which("git") is not None


def _gcm_query(ref: RepoRef) -> Dict[str, str]:
    if ref.provider == "ado":
        return {"protocol": "https", "host": "dev.azure.com", "path": f"{ref.org}/{ref.project}/_git/{ref.repo}"}
    return {"protocol": "https", "host": "github.com", "path": f"{ref.owner}/{ref.repo}"}


def gcm_token(ref: RepoRef) -> str:
    key = f"gcm:{ref.provider}:{ref.org or ref.owner}"
    tok = _cached(key)
    if tok:
        return tok
    if not git_available():
        raise RepoError(503, "git not found on this machine, so Git Credential Manager can't be asked for a token.")
    q = _gcm_query(ref)
    stdin = "".join(f"{k}={v}\n" for k, v in q.items()) + "\n"
    try:
        r = _run(["git", "credential", "fill"], stdin=stdin, timeout=30)
    except subprocess.TimeoutExpired:
        raise RepoError(504, "Git Credential Manager did not answer. Do a `git fetch` on that repo once in a terminal so it stores a credential, then retry.")
    fields = dict(line.split("=", 1) for line in r.stdout.splitlines() if "=" in line)
    token = fields.get("password", "")
    if r.returncode != 0 or not token:
        raise RepoError(401, "Git Credential Manager has no stored credential for this host. Run `git fetch` on a clone of the repo once (it will sign you in), then retry.")
    _cache[key] = (token, time.time() + 45 * 60)
    return token


# ---------- Microsoft sign-in in the browser (auth code + PKCE, public client) ----------
#
# The app starts the flow, the user approves in a popup, Microsoft redirects to this app's
# root URL on localhost with a code, and the app exchanges it. Tokens (incl. the refresh token)
# live in an msal cache file under DATA_DIR so the sign-in survives restarts; mount that
# directory as a volume in a container to keep it.

_msal_lock = threading.Lock()
_msal_app = None
_msal_cache = None
_pending_flows: Dict[str, Dict] = {}   # state -> flow


def msal_available() -> bool:
    return msal is not None


def _cache_path() -> str:
    return os.path.join(DATA_DIR, "msal_cache.json")


def _get_msal_app():
    global _msal_app, _msal_cache
    if not msal_available():
        raise RepoError(503, "Microsoft sign-in needs the 'msal' package: pip install msal")
    with _msal_lock:
        if _msal_app is None:
            _msal_cache = msal.SerializableTokenCache()
            try:
                with open(_cache_path(), "r", encoding="utf-8") as fh:
                    _msal_cache.deserialize(fh.read())
            except (OSError, ValueError):
                pass
            _msal_app = msal.PublicClientApplication(MSAL_CLIENT_ID, authority=MSAL_AUTHORITY, token_cache=_msal_cache)
        return _msal_app


def _persist_msal_cache() -> None:
    if _msal_cache is None or not _msal_cache.has_state_changed:
        return
    try:
        os.makedirs(DATA_DIR, exist_ok=True)
        tmp = _cache_path() + ".tmp"
        with open(tmp, "w", encoding="utf-8") as fh:
            fh.write(_msal_cache.serialize())
        try:
            os.chmod(tmp, 0o600)
        except OSError:
            pass
        os.replace(tmp, _cache_path())
    except OSError as exc:
        log.warning("could not persist sign-in cache: %s", exc)


def msal_account() -> Optional[str]:
    """Signed-in user (username claim) or None."""
    if not msal_available():
        return None
    accounts = _get_msal_app().get_accounts()
    return accounts[0].get("username") if accounts else None


def msal_start_login(redirect_uri: str) -> str:
    """Begin the browser flow; returns the URL the user must open."""
    app = _get_msal_app()
    flow = app.initiate_auth_code_flow(ADO_SCOPES, redirect_uri=redirect_uri, prompt="select_account")
    if "auth_uri" not in flow:
        raise RepoError(502, f"Could not start Microsoft sign-in: {flow.get('error_description') or flow}")
    _pending_flows[flow["state"]] = flow
    if len(_pending_flows) > 20:   # never let abandoned flows pile up
        for k in list(_pending_flows)[:-20]:
            _pending_flows.pop(k, None)
    return flow["auth_uri"]


def msal_complete_login(query: Dict[str, str]) -> str:
    """Finish the flow with the redirect's query parameters; returns the signed-in username."""
    flow = _pending_flows.pop(query.get("state", ""), None)
    if flow is None:
        raise RepoError(400, "This sign-in link has expired or was already used. Start again from Settings.")
    result = _get_msal_app().acquire_token_by_auth_code_flow(flow, query)
    _persist_msal_cache()
    if "access_token" not in result:
        raise RepoError(401, f"Microsoft sign-in failed: {result.get('error_description') or result.get('error') or 'unknown error'}")
    return (result.get("id_token_claims") or {}).get("preferred_username") or "signed in"


def msal_token() -> str:
    """Access token for Azure DevOps from the cached sign-in (silently refreshed)."""
    app = _get_msal_app()
    accounts = app.get_accounts()
    if not accounts:
        raise RepoError(401, "Not signed in with Microsoft yet. Open Settings and click Sign in.")
    result = app.acquire_token_silent(ADO_SCOPES, account=accounts[0])
    _persist_msal_cache()
    if not result or "access_token" not in result:
        raise RepoError(401, "Your Microsoft sign-in has expired. Open Settings and sign in again.")
    return result["access_token"]


def msal_logout() -> None:
    if not msal_available():
        return
    app = _get_msal_app()
    for acc in app.get_accounts():
        app.remove_account(acc)
    _persist_msal_cache()
    try:
        os.remove(_cache_path())
    except OSError:
        pass


# ---------- entry points ----------

def resolve_token(source: str, pat: str, ref: RepoRef) -> Tuple[str, str]:
    """Return (token, scheme) where scheme is 'basic' for PATs and 'bearer' for OAuth/Entra tokens."""
    source = (source or "pat").lower()
    if source == "pat":
        if not pat:
            raise RepoError(401, "Missing X-Repo-Token header")
        return pat, "basic"
    if source == "azcli":
        if ref.provider != "ado":
            raise RepoError(400, "Azure CLI sign-in only works for Azure DevOps repositories")
        return az_token(), "bearer"
    if source == "msal":
        if ref.provider != "ado":
            raise RepoError(400, "Microsoft sign-in only works for Azure DevOps repositories")
        return msal_token(), "bearer"
    if source == "gcm":
        return gcm_token(ref), "bearer"
    raise RepoError(400, f"Unknown auth source '{source}'. Use one of: {', '.join(SOURCES)}")


def describe_sources() -> Dict[str, Dict]:
    """What the UI can offer on this machine."""
    msal_acct = None
    if msal_available():
        try:
            msal_acct = msal_account()
        except RepoError:
            msal_acct = None
    return {
        "in_container": _in_container(),
        "pat": {"available": True},
        "msal": {"available": msal_available(), "account": msal_acct},
        "azcli": {"available": az_available(), "account": az_account() if az_available() else None},
        "gcm": {"available": git_available()},
    }
