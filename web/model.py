from generators.csharp import generate_csharp_class
from flask import Blueprint, request, jsonify

model_bp = Blueprint('model_bp', __name__)

@model_bp.route('/model', methods=['POST'])
def generate_classes():
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
    class_files[f"{base_class_name}.cs"] = generate_csharp_class(base_class_name, root_data, class_files)

    # Concatenate all class files into a single text block
    all_classes_text = "\n\n".join(class_files.values())

    # Return the concatenated class content as plain text

    return jsonify({"class_content": all_classes_text}), 200

if __name__ == "__main__":
    model_bp.run(debug=True)
