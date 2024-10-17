import logging

logger = logging.getLogger(__name__)

# Function to generate C# class structure from a dictionary or a primitive type
def generate_csharp_class(class_name, data, class_files):
    logging.info("Generating C# class: " + class_name)
    csharp_code = f'public class {class_name}\n{{\n'

    if isinstance(data, dict):
        for key, value in data.items():
            logging.info(f"Key: {key}, Value: {value}")
            property_type = get_csharp_type(value)
            logging.info("PropertyType: " + property_type)
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