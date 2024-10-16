def generate_python_class(class_name, data, class_files):
    python_code = f'class {class_name}:\n'

    if isinstance(data, dict):
        for key, value in data.items():
            property_type = get_python_type(value)
            if isinstance(value, dict):
                nested_class_name = key.capitalize()
                class_files[f"{nested_class_name}.py"] = generate_python_class(nested_class_name, value, class_files)
                python_code += f'    {key}: "{nested_class_name}"\n'
            elif isinstance(value, list):
                list_type = get_python_type(value[0]) if value else 'object'
                python_code += f'    {key}: List[{list_type}]\n'
            else:
                python_code += f'    {key}: {property_type}\n'
    else:
        python_code += f'    value: {get_python_type(data)}\n'

    return python_code

def get_python_type(value):
    if isinstance(value, int):
        return 'int'
    elif isinstance(value, float):
        return 'float'
    elif isinstance(value, bool):
        return 'bool'
    elif isinstance(value, str):
        return 'str'
    elif isinstance(value, list):
        return 'List'
    elif isinstance(value, dict):
        return 'dict'
    else:
        return 'object'
