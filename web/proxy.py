# proxy.py
from flask import Blueprint, request, jsonify
import requests

proxy_bp = Blueprint('proxy', __name__)

@proxy_bp.route('/proxy_request', methods=['POST'])
def proxy_request():
    data = request.json
    api_url = data.get('apiUrl')
    http_method = data.get('httpMethod')
    headers = data.get('headers')
    body = data.get('body')
    
    # Make the external API call based on provided method
    try:
        response = requests.request(
            method=http_method,
            url=api_url,
            headers=headers,
            json=body
        )
        # Send back the response content and status code
        return jsonify({
            "status_code": response.status_code,
            "content": response.json() if response.headers.get("Content-Type") == "application/json" else response.text
        }), response.status_code
    except requests.exceptions.RequestException as e:
        # Handle errors and return an error message
        return jsonify({"error": str(e)}), 500
