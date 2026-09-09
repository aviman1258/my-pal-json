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

from flask import Flask, render_template
from flask_cors import CORS

from .analyze import analyze_bp
from .model import model_bp
from .proxy import proxy_bp
from .repo import repo_bp

app = Flask(__name__)
CORS(app)

app.register_blueprint(analyze_bp)
app.register_blueprint(model_bp)
app.register_blueprint(proxy_bp)
app.register_blueprint(repo_bp)


@app.route('/')
def serve_html():
    return render_template('json-analyzer.html')


def _truthy(value: str) -> bool:
    return (value or "").strip().lower() not in ("", "0", "false", "no", "off")


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5000"))
    if _truthy(os.environ.get("MPJ_OPEN_BROWSER", "1")):
        Timer(1, lambda: webbrowser.open_new(f"http://127.0.0.1:{port}")).start()
    app.run(host="127.0.0.1", port=port, debug=False)
