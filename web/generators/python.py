import json

def generate_python_class(json_data, class_name="GeneratedClass", indent_level=0):
    # Helper function to generate indent
    def indent(level):
        return " " * 4 * level

    # Start building the class definition
    class_definition = f"{indent(indent_level)}class {class_name}:\n"
    class_definition += f"{indent(indent_level + 1)}def __init__(self, "

    # Initialize a list to store the constructor parameters
    constructor_params = []
    nested_class_definitions = ""
    
    # Extract keys and generate constructor parameters
    for key, value in json_data.items():
        if isinstance(value, dict):
            # Handle nested dictionary by generating a new class
            nested_class_name = key.capitalize()
            constructor_params.append(f"{key}: {nested_class_name}")
            nested_class_definitions += generate_python_class(value, class_name=nested_class_name, indent_level=indent_level + 1)
        elif isinstance(value, list):
            if value and isinstance(value[0], dict):
                # Handle list of nested dictionaries
                nested_class_name = key.capitalize()[:-1]  # Remove the 's' from key for plural
                constructor_params.append(f"{key}: list[{nested_class_name}]")
                nested_class_definitions += generate_python_class(value[0], class_name=nested_class_name, indent_level=indent_level + 1)
            else:
                constructor_params.append(f"{key}: list")
        else:
            # Handle primitive types
            constructor_params.append(f"{key}: {type(value).__name__}")

    # Add constructor parameters to the init method
    class_definition += ", ".join(constructor_params) + "):\n"

    # Add class attributes inside the constructor
    for key, value in json_data.items():
        class_definition += f"{indent(indent_level + 2)}self.{key} = {key}\n"

    # Append any nested class definitions after the current class
    class_definition += "\n" + nested_class_definitions

    return class_definition