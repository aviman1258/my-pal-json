def generate_go_struct(struct_name, data, struct_definitions=None):
    if struct_definitions is None:
        struct_definitions = {}

    # If the struct has already been generated, return immediately
    if struct_name in struct_definitions:
        return ''

    # Start building the Go struct
    go_code = f'type {struct_name} struct {{\n'

    attributes = []

    # For each key-value pair in the JSON data
    if isinstance(data, dict):
        for key, value in data.items():
            if isinstance(value, dict):
                # If value is a nested object, create a new struct for it
                nested_struct_name = key.capitalize()
                attributes.append(f'{key.capitalize()} {nested_struct_name}')
                # Recursively generate the nested struct only if it hasn't been generated
                if nested_struct_name not in struct_definitions:
                    generate_go_struct(nested_struct_name, value, struct_definitions)
            elif isinstance(value, list):
                if value and isinstance(value[0], dict):
                    # Singularize the struct name if it ends with 's'
                    if key.endswith('s'):
                        singular_key = key[:-1].capitalize()
                    else:
                        singular_key = key.capitalize()

                    attributes.append(f'{key.capitalize()} []{singular_key}')
                    # Recursively generate the struct for the objects in the array only if it hasn't been generated
                    if singular_key not in struct_definitions:
                        generate_go_struct(singular_key, value[0], struct_definitions)
                else:
                    # If the value is a list of primitives, use an empty slice
                    attributes.append(f'{key.capitalize()} []{get_go_type(value)}')
            else:
                # For primitive values, initialize with Go types
                attributes.append(f'{key.capitalize()} {get_go_type(value)}')
    else:
        # If data is not a dict, just set a single value
        attributes.append(f'Value {get_go_type(data)}')

    # Add struct attributes
    go_code += '\n'.join(f'  {attr}' for attr in attributes) + '\n'

    go_code += '}\n'

    # Store the generated struct definition, keyed by the struct name
    struct_definitions[struct_name] = go_code

    # Return the combined struct definitions as a single string after all structs are generated
    return '\n'.join(struct_definitions.values())


# Helper function to get the Go type for a given value
def get_go_type(value):
    if isinstance(value, int):
        return 'int'
    elif isinstance(value, float):
        return 'float64'
    elif isinstance(value, bool):
        return 'bool'
    elif isinstance(value, str):
        return 'string'
    elif isinstance(value, list):
        return '[]interface{}'  # Assuming heterogeneous lists
    elif isinstance(value, dict):
        return 'map[string]interface{}'  # For complex objects
    else:
        return 'interface{}'
