def generate_javascript_class(class_name, data, class_files):
    js_code = f'class {class_name} {{\n'
    js_code += '  constructor() {\n'

    if isinstance(data, dict):
        for key, value in data.items():
            js_code += f'    this.{key} = null;\n'
    else:
        js_code += f'    this.value = null;\n'

    js_code += '  }\n}\n'

    return js_code
