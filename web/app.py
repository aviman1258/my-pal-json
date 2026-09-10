"""My Pal JSON: Flask entry point."""
import os
import webbrowser
from threading import Timer

# Trust the operating system's certificate store (corporate TLS inspection roots live there).
# Falls back silently to Python's bundled bundle when truststore is unavailable.
try:
    import truststore
    truststore.inject_into_ssl()
except ImportError:  # pragma: no cover
    pass

from flask import Flask, render_template, request
from flask_cors import CORS
from markupsafe import escape

from .analyze import analyze_bp
from .auth_sources import msal_complete_login
from .model import model_bp
from .providers.base import RepoError
from .proxy import proxy_bp
from .repo import repo_bp

app = Flask(__name__)
CORS(app)

app.register_blueprint(analyze_bp)
app.register_blueprint(model_bp)
app.register_blueprint(proxy_bp)
app.register_blueprint(repo_bp)


_POPUP_PAGE = """<!doctype html><meta charset="utf-8"><title>My Pal JSON sign-in</title>
<body style="font-family:sans-serif;background:#1f1f1f;color:#e0e0e0;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
<div style="text-align:center"><h2 style="color:{color}">{title}</h2><p>{detail}</p><p style="color:#9e9e9e">You can close this window.</p></div>
<script>setTimeout(function(){{ window.close(); }}, 1500);</script></body>"""


@app.route('/')
def serve_html():
    # Microsoft sign-in redirects back here (redirect URI must be the app root on localhost).
    if request.args.get("state") and (request.args.get("code") or request.args.get("error")):
        try:
            user = msal_complete_login(request.args.to_dict())
            return _POPUP_PAGE.format(color="#4caf50", title="Signed in", detail=f"as {escape(user)}")
        except RepoError as exc:
            return _POPUP_PAGE.format(color="#f44336", title="Sign-in failed", detail=escape(exc.message)), exc.status
    return render_template('json-analyzer.html')


def _truthy(value: str) -> bool:
    return (value or "").strip().lower() not in ("", "0", "false", "no", "off")


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5000"))
    if _truthy(os.environ.get("MPJ_OPEN_BROWSER", "1")):
        Timer(1, lambda: webbrowser.open_new(f"http://127.0.0.1:{port}")).start()
    app.run(host="127.0.0.1", port=port, debug=False)
