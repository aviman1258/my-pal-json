def generate_cpp_class(class_name, data, class_files):
    cpp_code = f'class {class_name} {{\n'
    cpp_code += 'public:\n'

    if isinstance(data, dict):
        for key, value in data.items():
            cpp_code += f'    {get_cpp_type(value)} {key};\n'
    else:
        cpp_code += f'    {get_cpp_type(data)} value;\n'

    cpp_code += '};\n'
    return cpp_code

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
        return 'std::vector'
    else:
        return 'auto'
