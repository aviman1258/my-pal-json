def generate_cpp_class(class_name, data, class_definitions=None):
    if class_definitions is None:
        class_definitions = {}

    # If the class has already been generated, return immediately
    if class_name in class_definitions:
        return ''

    # Start building the C++ class
    cpp_code = f'class {class_name} {{\n'
    cpp_code += 'public:\n'
    cpp_code += f'  {class_name}() {{\n'

    attributes = []

    # For each key-value pair in the JSON data
    if isinstance(data, dict):
        for key, value in data.items():
            if isinstance(value, dict):
                # If value is a nested object, create a new class for it
                nested_class_name = key.capitalize()
                attributes.append(f'{nested_class_name} {key};')
                cpp_code += f'    this->{key} = {nested_class_name}();\n'
                # Recursively generate the nested class only if it hasn't been generated
                if nested_class_name not in class_definitions:
                    generate_cpp_class(nested_class_name, value, class_definitions)
            elif isinstance(value, list):
                if value and isinstance(value[0], dict):
                    # Singularize the class name if it ends with 's'
                    if key.endswith('s'):
                        singular_key = key[:-1].capitalize()
                    else:
                        singular_key = key.capitalize()

                    attributes.append(f'std::vector<{singular_key}> {key};')
                    cpp_code += f'    this->{key} = std::vector<{singular_key}>();\n'

                    # Recursively generate the class for the objects in the array only if it hasn't been generated
                    if singular_key not in class_definitions:
                        generate_cpp_class(singular_key, value[0], class_definitions)
                else:
                    # If the value is a list of primitives, use an empty array
                    attributes.append(f'std::vector<{get_cpp_type(value)}> {key};')
                    cpp_code += f'    this->{key} = std::vector<{get_cpp_type(value)}>();\n'
            else:
                # For primitive values, initialize to null (nullptr for pointers or default values)
                attributes.append(f'{get_cpp_type(value)} {key};')
                cpp_code += f'    this->{key} = {get_cpp_default_value(value)};\n'
    else:
        # If data is not a dict, just set a single value
        attributes.append(f'{get_cpp_type(data)} value;')
        cpp_code += f'    this->value = {get_cpp_default_value(data)};\n'

    cpp_code += '  }\n'

    # Add class attributes
    cpp_code += '\nprivate:\n'
    cpp_code += '\n'.join(f'  {attr}' for attr in attributes) + '\n'

    cpp_code += '};\n'

    # Store the generated class definition, keyed by the class name
    class_definitions[class_name] = cpp_code

    # Return the combined class definitions as a single string after all classes are generated
    return '\n'.join(class_definitions.values())


# Helper function to get the C++ type for a given value
def get_cpp_type(value):
    if isinstance(value, int):
        return 'int'
    elif isinstance(value, float):
        return 'double'
    elif isinstance(value, bool):
        return 'bool'
    elif isinstance(value, str):
        return 'std::string'
    elif isinstance(value, list):
        return 'std::vector<auto>'  # Assuming homogeneous lists
    elif isinstance(value, dict):
        return 'std::map<std::string, auto>'  # For complex objects
    else:
        return 'auto'


# Helper function to get the default value for a given C++ type
def get_cpp_default_value(value):
    if isinstance(value, int):
        return '0'
    elif isinstance(value, float):
        return '0.0'
    elif isinstance(value, bool):
        return 'false'
    elif isinstance(value, str):
        return '""'
    elif isinstance(value, list):
        return '{}'
    elif isinstance(value, dict):
        return '{}'
    else:
        return 'nullptr'
