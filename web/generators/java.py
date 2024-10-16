def generate_java_class(class_name, data, class_files):
    java_code = f'public class {class_name} {{\n'

    if isinstance(data, dict):
        for key, value in data.items():
            java_code += f'    private {get_java_type(value)} {key};\n'
    else:
        java_code += f'    private {get_java_type(data)} value;\n'

    java_code += '}\n'
    return java_code

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
        return 'List'
    else:
        return 'Object'
