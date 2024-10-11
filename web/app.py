from flask import Flask, send_from_directory
from flask_cors import CORS
from analyze import analyze_bp
from model import model_bp
import os
import webbrowser
from threading import Timer

app = Flask(__name__)
CORS(app)

# Register the blueprints
app.register_blueprint(analyze_bp)
app.register_blueprint(model_bp)

# Serve json-analyzer.html
@app.route('/')
def serve_html():
    return send_from_directory(os.path.join(app.root_path, 'web'), 'json-analyzer.html')

def open_browser():
    webbrowser.open_new("http://127.0.0.1:5000")

if __name__ == "__main__":
    Timer(1, open_browser).start()  # Open the browser after a 1-second delay
    app.run(debug=True)
    
