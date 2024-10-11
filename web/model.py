import json
import io
import zipfile
from flask import Blueprint, request, jsonify, send_file

model_bp = Blueprint('model_bp', __name__)

# Function to generate C# class structure from a dictionary or a primitive type
def generate_csharp_class(class_name, data):
    csharp_code = f'public class {class_name}\n{{\n'

    if isinstance(data, dict):
        for key, value in data.items():
            property_type = get_csharp_type(value)
            if isinstance(value, dict):
                nested_class_name = key.capitalize()
                csharp_code += f'    public {nested_class_name} {key.capitalize()} {{ get; set; }}\n'
            elif isinstance(value, list):
                if value and isinstance(value[0], dict):  # List of objects
                    nested_class_name = key.capitalize()[:-1]
                    csharp_code += f'    public List<{nested_class_name}> {key.capitalize()} {{ get; set; }}\n'
                else:
                    list_type = get_csharp_type(value[0]) if value else 'object'
                    csharp_code += f'    public List<{list_type}> {key.capitalize()} {{ get; set; }}\n'
            else:
                csharp_code += f'    public {property_type} {key.capitalize()} {{ get; set; }}\n'
    else:
        property_type = get_csharp_type(data)
        csharp_code += f'    public {property_type} Value {{ get; set; }}\n'

    csharp_code += '}\n'
    return csharp_code

# Function to determine the C# type of a JSON value
def get_csharp_type(value):
    if isinstance(value, int):
        return 'int'
    elif isinstance(value, float):
        return 'double'
    elif isinstance(value, bool):
        return 'bool'
    elif isinstance(value, str):
        return 'string'
    elif isinstance(value, list):
        return 'List<object>'
    elif isinstance(value, dict):
        return 'object'
    else:
        return 'object'

# Route to handle JSON input and generate C# classes
@model_bp.route('/model', methods=['POST'])
def generate_classes():
    json_data = request.get_json()  # Get JSON from request

    if not json_data:
        return jsonify({"error": "Invalid or no JSON data received"}), 400

    class_files = {}

    # Determine the root element
    if isinstance(json_data, dict) and len(json_data) == 1:
        root_key = list(json_data.keys())[0]
        root_data = json_data[root_key]
        base_class_name = root_key.capitalize()
    else:
        base_class_name = 'Root'
        root_data = json_data

    # Generate the base class and nested classes
    class_files[f"{base_class_name}.cs"] = generate_csharp_class(base_class_name, root_data)

    # Send the list of class file names as links
    file_links = [{"name": f"{file_name}"} for file_name in class_files.keys()]
    return jsonify({"files": file_links})

# Route to download individual class file
@model_bp.route('/download/<filename>', methods=['GET'])
def download_class(filename):
    json_data = request.args.get('json')  # This can be replaced with the actual JSON processing logic if needed
    class_name = filename.split('.')[0]
    class_content = generate_csharp_class(class_name, json.loads(json_data))

    # Return the C# class file as a downloadable file
    return send_file(io.BytesIO(class_content.encode()), download_name=filename, as_attachment=True)

# Route to download all files in a zip
@model_bp.route('/download-all', methods=['POST'])
def download_all():
    json_data = request.get_json()
    
    if not json_data:
        return jsonify({"error": "Invalid or no JSON data received"}), 400

    class_files = {}

    # Determine the root element
    if isinstance(json_data, dict) and len(json_data) == 1:
        root_key = list(json_data.keys())[0]
        root_data = json_data[root_key]
        base_class_name = root_key.capitalize()
    else:
        base_class_name = 'Root'
        root_data = json_data

    # Generate the base class and nested classes
    class_files[f"{base_class_name}.cs"] = generate_csharp_class(base_class_name, root_data)

    # Create a zip archive in memory
    memory_file = io.BytesIO()
    with zipfile.ZipFile(memory_file, 'w') as zf:
        for filename, content in class_files.items():
            zf.writestr(filename, content)
    memory_file.seek(0)

    # Return the zip file as a downloadable file
    return send_file(memory_file, download_name="csharp_classes.zip", as_attachment=True)

if __name__ == "__main__":
    model_bp.run(debug=True)
