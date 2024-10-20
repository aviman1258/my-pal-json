def generate_java_class(class_name, data, class_definitions=None):
    if class_definitions is None:
        class_definitions = {}

    # If the class has already been generated, return immediately
    if class_name in class_definitions:
        return ''

    # Start building the Java class
    java_code = f'public class {class_name} {{\n'
    java_code += f'  public {class_name}() {{\n'

    attributes = []

    # For each key-value pair in the JSON data
    if isinstance(data, dict):
        for key, value in data.items():
            if isinstance(value, dict):
                # If value is a nested object, create a new class for it
                nested_class_name = key.capitalize()
                attributes.append(f'private {nested_class_name} {key};')
                java_code += f'    this.{key} = new {nested_class_name}();\n'
                # Recursively generate the nested class only if it hasn't been generated
                if nested_class_name not in class_definitions:
                    generate_java_class(nested_class_name, value, class_definitions)
            elif isinstance(value, list):
                if value and isinstance(value[0], dict):
                    # Singularize the class name if it ends with 's'
                    if key.endswith('s'):
                        singular_key = key[:-1].capitalize()
                    else:
                        singular_key = key.capitalize()

                    attributes.append(f'private List<{singular_key}> {key};')
                    java_code += f'    this.{key} = new ArrayList<>();\n'

                    # Recursively generate the class for the objects in the array only if it hasn't been generated
                    if singular_key not in class_definitions:
                        generate_java_class(singular_key, value[0], class_definitions)
                else:
                    # If the value is a list of primitives, use an empty list
                    attributes.append(f'private List<{get_java_type(value)}> {key};')
                    java_code += f'    this.{key} = new ArrayList<>();\n'
            else:
                # For primitive values, initialize to default values
                attributes.append(f'private {get_java_type(value)} {key};')
                java_code += f'    this.{key} = {get_java_default_value(value)};\n'
    else:
        # If data is not a dict, just set a single value
        attributes.append(f'private {get_java_type(data)} value;')
        java_code += f'    this.value = {get_java_default_value(data)};\n'

    java_code += '  }\n'

    # Add class attributes
    java_code += '\n'.join(f'  {attr}' for attr in attributes) + '\n'

    java_code += '}\n'

    # Store the generated class definition, keyed by the class name
    class_definitions[class_name] = java_code

    # Return the combined class definitions as a single string after all classes are generated
    return '\n'.join(class_definitions.values())


# Helper function to get the Java type for a given value
def get_java_type(value):
    if isinstance(value, int):
        return 'int'
    elif isinstance(value, float):
        return 'double'
    elif isinstance(value, bool):
        return 'boolean'
    elif isinstance(value, str):
        return 'String'
    elif isinstance(value, list):
        return 'List<Object>'  # Assuming homogeneous lists
    elif isinstance(value, dict):
        return 'Map<String, Object>'  # For complex objects
    else:
        return 'Object'


# Helper function to get the default value for a given Java type
def get_java_default_value(value):
    if isinstance(value, int):
        return '0'
    elif isinstance(value, float):
        return '0.0'
    elif isinstance(value, bool):
        return 'false'
    elif isinstance(value, str):
        return '""'
    elif isinstance(value, list):
        return 'new ArrayList<>()'
    elif isinstance(value, dict):
        return 'new HashMap<>()'
    else:
        return 'null'
