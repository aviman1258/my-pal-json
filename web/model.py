import logging
from .generators.csharp import generate_csharp_class as generate_csharp
from .generators.python import generate_python_class as generate_python
from .generators.javascript import generate_javascript_class as generate_javascript
from .generators.cplusplus import generate_cpp_class as generate_cpp
from .generators.java import generate_java_class as generate_java
from .generators.go import generate_go_struct as generate_go
from flask import Blueprint, request, jsonify

logger = logging.getLogger(__name__)

model_bp = Blueprint('model_bp', __name__)

@model_bp.route('/model', methods=['POST'])
def generate_classes():
    json_data = request.get_json()
    language = request.args.get('language', 'csharp')
    logger.info('Language to model: ' + language)

    if not json_data:
        logger.error("Invalid or no JSON data received.")
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

    # Generate the base class and nested classes  from 
    
    if language == 'csharp':
        class_files[f"{base_class_name}.cs"] = generate_csharp(base_class_name, root_data, class_files)
    elif language == 'python':
        class_files[f"{base_class_name}.py"] = generate_python(json_data, base_class_name, 0)
    elif language == 'javascript':
        class_files[f"{base_class_name}.js"] = generate_javascript(base_class_name, root_data)
    elif language == 'cplusplus':
        class_files[f"{base_class_name}.cpp"] = generate_cpp(base_class_name, root_data, class_files)
    elif language == 'java':
        class_files[f"{base_class_name}.java"] = generate_java(base_class_name, root_data, class_files)
    elif language == 'go':
        class_files[f"{base_class_name}.go"] = generate_go(base_class_name, root_data, class_files)
        
    # Concatenate all class files into a single text block
    all_classes_text = "\n\n".join(class_files.values())

    logging.info("Model: " + all_classes_text)

    # Return the concatenated class content as plain text

    return jsonify({"class_content": all_classes_text}), 200

if __name__ == "__main__":
    model_bp.run(debug=True)
