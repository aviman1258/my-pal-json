import io
from flask import Blueprint, request, jsonify, send_file

model_bp = Blueprint('model_bp', __name__)

# Function to generate C# class structure from a dictionary or a primitive type
def generate_csharp_class(class_name, data, class_files):
    csharp_code = f'public class {class_name}\n{{\n'

    if isinstance(data, dict):
        for key, value in data.items():
            property_type = get_csharp_type(value)
            if isinstance(value, dict):
                nested_class_name = key.capitalize()
                # Recursively generate nested class for this dictionary
                class_files[f"{nested_class_name}.cs"] = generate_csharp_class(nested_class_name, value, class_files)
                csharp_code += f'    public {nested_class_name} {key.capitalize()} {{ get; set; }}\n'
            elif isinstance(value, list):
                if value and isinstance(value[0], dict):  # List of objects
                    nested_class_name = key.capitalize()[:-1]
                    # Recursively generate nested class for the first element in the list
                    class_files[f"{nested_class_name}.cs"] = generate_csharp_class(nested_class_name, value[0], class_files)
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
