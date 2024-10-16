def generate_go_struct(class_name, data, class_files):
    go_code = f'type {class_name} struct {{\n'

    if isinstance(data, dict):
        for key, value in data.items():
            go_code += f'    {key.capitalize()} {get_go_type(value)} `json:"{key}"`\n'
    else:
        go_code += f'    Value {get_go_type(data)}\n'

    go_code += '}\n'
    return go_code

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
        return '[]interface{}'
    else:
        return 'interface{}'
