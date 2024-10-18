def generate_javascript_class(class_name, data, class_definitions=None):
    if class_definitions is None:
        class_definitions = {}

    # Avoid re-generating classes that already exist
    if class_name in class_definitions:
        return ''

    # Start building the JavaScript class
    js_code = f'class {class_name} {{\n'
    js_code += '  constructor() {\n'

    # For each key-value pair in the JSON data
    if isinstance(data, dict):
        for key, value in data.items():
            if isinstance(value, dict):
                # If value is a nested object, create a new class for it
                nested_class_name = key.capitalize()
                js_code += f'    this.{key} = new {nested_class_name}();\n'
                # Recursively generate the nested class only if it hasn't been generated
                if nested_class_name not in class_definitions:
                    generate_javascript_class(nested_class_name, value, class_definitions)
            elif isinstance(value, list):
                if value and isinstance(value[0], dict):
                    # Singularize the class name if it ends with 's'
                    if key.endswith('s'):
                        singular_key = key[:-1].capitalize()
                    else:
                        singular_key = key.capitalize()

                    js_code += f'    this.{key} = [new {singular_key}()];\n'

                    # Recursively generate the class for the objects in the array only if it hasn't been generated
                    if singular_key not in class_definitions:
                        generate_javascript_class(singular_key, value[0], class_definitions)
                else:
                    # If the value is a list of primitives, use an empty array
                    js_code += f'    this.{key} = [];\n'
            else:
                # For primitive values, initialize to null
                js_code += f'    this.{key} = null;\n'
    else:
        # If data is not a dict, just set a single value
        js_code += '    this.value = null;\n'

    js_code += '  }\n'
    js_code += '}\n'

    # Store the generated class definition, keyed by the class name
    class_definitions[class_name] = js_code

    # Return the combined class definitions as a single string after all classes are generated
    return '\n'.join(class_definitions.values())
