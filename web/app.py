from flask import Flask
from flask_cors import CORS
from analyze import analyze_bp

app = Flask(__name__)
CORS(app)

# Register the blueprints
app.register_blueprint(analyze_bp)

# Root route to check server status
@app.route('/')
def index():
    return "Flask server is running."

if __name__ == "__main__":
    app.run(debug=True)