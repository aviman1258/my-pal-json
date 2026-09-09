# My Pal JSON

A local API client that lives in your browser and keeps its collections in your git repo.

- Send requests, inspect responses, analyze JSON structure, generate model classes in C#, Python, JavaScript, C++, Java or Go.
- **Collections come from a repository.** Point it at an Azure DevOps or GitHub repo that holds Postman v2.1 collections, pull them, edit, and push back. Teammates using Postman see the same files.
- **Chain requests visually.** Stack requests top to bottom, click a value in one response to turn it into a `{{variable}}` for the next step, run the whole chain or from any point.
- Runs entirely on your machine (Podman, Docker, or plain Python), so `localhost` APIs, VPN-only hosts and secrets never leave it.

## Quick start (Windows, PowerShell)

Copy and paste each block into PowerShell. You need [Podman](https://podman-desktop.io/) installed, nothing else.

**1. Wake up Podman** (says "already running" if it is, that's fine):

```powershell
podman machine start
```

**2. Get the app.** Pick one.

Easiest, no code needed:

```powershell
podman pull docker.io/achandra1258/my-pal-json:2.0
```

Or build it from the code:

```powershell
git clone https://github.com/aviman1258/my-pal-json.git
cd my-pal-json
podman build --build-arg PIP_EXTRA_ARGS="--trusted-host pypi.org --trusted-host files.pythonhosted.org" -t docker.io/achandra1258/my-pal-json:2.0 .
```

(The long `--build-arg` is only needed on a work network that inspects HTTPS. It's harmless elsewhere.)

**3. Start it:**

```powershell
podman run --name my-pal-json -d -p 127.0.0.1:5000:5000 docker.io/achandra1258/my-pal-json:2.0
```

**4. Open it:** <http://localhost:5000>

That's it. Day to day:

```powershell
podman stop my-pal-json      # stop
podman start my-pal-json     # start again
podman ps                    # is it running?
podman rm -f my-pal-json     # remove completely
```

**Upgrading** to a newer version:

```powershell
podman rm -f my-pal-json
podman pull docker.io/achandra1258/my-pal-json:2.0
podman run --name my-pal-json -d -p 127.0.0.1:5000:5000 docker.io/achandra1258/my-pal-json:2.0
```

**Need to call an API running on your own laptop** (`localhost:44300` and friends)? On Windows the container can't see those, so run the app directly instead. Python 3.10+ required:

```powershell
git clone https://github.com/aviman1258/my-pal-json.git
cd my-pal-json
pip install -r web\requirements.txt
python -m web.app
```

The browser opens by itself. `Ctrl+C` stops it. Details on why, and what works on Linux and macOS, are under **Run it** below.

## Run it

### With Podman (or Docker)

```sh
podman pull docker.io/achandra1258/my-pal-json:2.0
podman run --name my-pal-json -d -p 127.0.0.1:5000:5000 docker.io/achandra1258/my-pal-json:2.0
```

Then open <http://localhost:5000>.

Docker is identical, except the container needs to know the host's name for localhost rewriting:

```sh
docker run --name my-pal-json -d -p 127.0.0.1:5000:5000 -e HOST_ALIAS=host.docker.internal achandra1258/my-pal-json:2.0
```

(On Linux Docker also add `--add-host=host.docker.internal:host-gateway`.)

Or from a clone: `podman compose up -d` / `docker compose up -d` uses `compose.yaml`.

**Calling APIs on your own machine from the container.** Inside a container, `localhost` is the container. The app rewrites `localhost` / `127.0.0.1` targets to the hosts in `HOST_ALIAS` (comma-separated, default `host.containers.internal,host.docker.internal`) and uses the first one that connects. The status line shows the host it actually used. For self-signed local certificates tick **skip TLS** next to Send.

How far that gets you depends on the platform:

| Where the container runs | `localhost:44300` on your machine |
|---|---|
| Podman or Docker on Linux, Docker Desktop / Podman on macOS | Works: the alias resolves to your machine. |
| Podman on Windows (WSL backend) | Usually **doesn't**. The alias resolves to the WSL VM, not Windows. Windows is only reachable if the API listens on all interfaces (not just localhost, which rules out IIS Express and most dev servers) *and* Windows Firewall lets the WSL adapter in *and* you pass the WSL adapter address, e.g. `-e HOST_ALIAS=host.containers.internal,172.19.0.1` (find it with `ipconfig`, "vEthernet (WSL)"). |

On a Windows machine where you need local APIs, skip the container and run from source (below). It is two commands, and `localhost` then just works. The container is still the easiest way to run the tool for everything else.

**Corporate TLS inspection.** If your network re-signs HTTPS, drop the corporate root certificate (`.crt` or `.pem`) into a folder and mount it at `/certs`:

```sh
podman run -d -p 127.0.0.1:5000:5000 -v ./certs:/certs:ro docker.io/achandra1258/my-pal-json:2.0
```

The container trusts it on startup. Running from source on Windows or macOS needs nothing extra; the app trusts the operating system's certificate store.

### From source

Python 3.10 or newer.

```sh
git clone https://github.com/aviman1258/my-pal-json.git
cd my-pal-json
pip install -r web/requirements.txt
python -m web.app
```

The browser opens automatically. Set `MPJ_OPEN_BROWSER=0` to suppress that, `PORT=5001` to change the port.

## Using it

### Request tab

1. Pick the method, type the URL, add headers in the grid. Tick **IsAuth** on a header to have its value sent as `Bearer <value>`; auth values are never written to the repo as literals.
2. Type or drop a JSON body under **Request**. Send. The response lands under **Response** with status, timing and headers above it.
3. **Pretty** formats the body. **Analyze** shows the JSON structure as a tree. **Model** generates classes in the selected language. **Copy** copies the output.
4. `{{variables}}` in the URL, headers or body are filled from the active **environment** (picker in the request bar). Unresolved names are flagged in the status line.

### Collections from a repository

Open **Settings** (gear icon) → **Repositories**.

1. Paste the repo URL, e.g. `https://dev.azure.com/org/project/_git/repo` or `https://github.com/owner/repo`.
2. Paste a Personal Access Token and **Test connection**. Scopes: Azure DevOps **Code (Read & Write)**; GitHub fine-grained **Contents: Read and write** on that repo.
3. Save. The token is stored only in your browser's IndexedDB on `localhost` and is sent to the local Flask process with each repo call; it never goes anywhere else and is not stored in the container.

Then open the **Collections** drawer (top-left icon):

- **Pull** lists every `*.postman_collection.json` and `*.mypaljson_chain.json` at the repo root and one folder down, and shows them as a tree.
- Click a request to load it into the Request tab. Right-click (or ⋯) a row for **New request / New folder / Rename / Duplicate / Delete**. **+** creates a new collection file.
- **Save** (or Ctrl+S) writes the form back into the loaded request; **Save as…** adds it somewhere else. Changes stay local until you **Push**.
- **Push** commits one file per changed collection with your message. Before writing, values in secret-looking headers, query parameters and body fields (`Authorization`, `x-api-key`, `client_secret`, …) are moved into your active environment and replaced with `{{placeholders}}`, so the request keeps working for you while the repo only sees the placeholder. The dialog lists what moved. Same key and same value reuse one variable; a different value under the same key becomes `apiKey2`, `apiKey3`, and so on, and existing environment values are never overwritten. If someone else changed the file in the meantime you get a clear "changed on the server, pull again" message instead of a silent overwrite.

Everything the app doesn't understand in a collection (pre-request scripts, tests, descriptions, auth blocks, ids) round-trips untouched. Pre-request scripts are not executed.

### Environments

**Settings → Environments.** Create key/value sets, or drop a `*.postman_environment.json` file onto the pane to import it. Pick the active one from the request bar. Environments stay in the browser and are never pushed, which is where secrets like tokens and API keys belong.

### Chain tab

A chain runs requests in order and passes values between them.

1. **New** chain, then **+ Add step**: from a collection, from the Request tab, or blank.
2. Expand a step. Run it once with ▶. In the response, **+ pick from response** and click any value: its JSON path (e.g. `$.data[0].id`) becomes a named output. **+ pick header** does the same for a response header. **+ manual** lets you type a path.
3. Use the output as `{{name}}` in any later step. Numbers insert unquoted, so `"id": {{userId}}` gives `"id": 7`; wrap text in quotes yourself. Inputs that reference a variable nothing provides are outlined in yellow before you even run; click the name in the warning to define it on the spot.
   Values can come from three places, later ones win: the active **environment** (secrets, per-machine values), **chain variables** (the panel above the steps: test ids and other values that should travel with the chain file), and **outputs** of earlier steps.
4. **▶ Run chain** runs everything; ▶▶ on a step runs from there using the outputs the last run captured; ▶ runs just that step. A failing step (HTTP 4xx/5xx or an unresolved variable) stops the chain unless **continue on error** is ticked. Drag the ⋮⋮ handle to reorder.
5. Chains autosave as drafts in the browser. **Push to repo** commits `<name>.mypaljson_chain.json` next to your collections so the chain travels with the team; chains found in the repo appear in the chain picker for import. Literal secrets (auth headers, secret-looking header names, body fields like `apiKey` or `clientSecret`, secret-looking chain variables) are moved into your active environment and replaced with `{{placeholders}}` before the push, after a confirmation that lists them. The chain keeps running on your machine; teammates set the same variables in their own environment. Naming follows the collection rule: `apiKey`, then `apiKey2` for a different value.

Chain file format (`schemaVersion: 1`):

```json
{
  "schemaVersion": 1,
  "name": "TU-Screening",
  "variables": { "landlordId": "5975200", "propertyId": "2763882" },
  "steps": [{
    "id": "s_8f3k2a",
    "label": "Get token",
    "source": { "collection": "TU", "requestName": "Create-Token" },
    "request": { "method": "POST", "url": "{{base}}/v2/Tokens",
                 "headers": [{ "name": "Content-Type", "value": "application/json", "isAuth": false }],
                 "body": "{ \"ClientId\": \"{{clientId}}\" }" },
    "outputs": [{ "name": "token", "source": "body", "path": "$.token" }],
    "options": { "continueOnError": false, "delayMs": 0, "verifyTls": true }
  }]
}
```

## Development

```sh
pip install -r web/requirements.txt
MPJ_OPEN_BROWSER=0 python -m web.app          # http://127.0.0.1:5000
podman build -t docker.io/achandra1258/my-pal-json:2.0 .
```

Publishing a new image so others can `podman pull` it:

```powershell
podman login docker.io
podman build --build-arg PIP_EXTRA_ARGS="--trusted-host pypi.org --trusted-host files.pythonhosted.org" -t docker.io/achandra1258/my-pal-json:2.0 .
podman tag docker.io/achandra1258/my-pal-json:2.0 docker.io/achandra1258/my-pal-json:latest
podman push docker.io/achandra1258/my-pal-json:2.0
podman push docker.io/achandra1258/my-pal-json:latest
```

Layout: `web/app.py` (Flask), `web/proxy.py` (outbound requests), `web/repo.py` + `web/providers/` (Azure DevOps and GitHub file access), `web/analyze.py` and `web/model.py` + `web/generators/` (tree and class generation), `web/static/scripts/` (vanilla ES modules, no build step), `web/static/styles/style.css` (theme tokens on `:root` and `[data-theme="light"]`).

## License

See [LICENSE](LICENSE).
