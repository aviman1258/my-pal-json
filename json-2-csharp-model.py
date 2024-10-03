import json
import os
import sys
import shutil

# Function to generate C# class structure from a dictionary or a primitive type
def generate_csharp_class(class_name, data):
    csharp_code = f'public class {class_name}\n{{\n'
    
    if isinstance(data, dict):
        for key, value in data.items():
            property_type = get_csharp_type(value)
            if isinstance(value, dict):
                nested_class_name = key.capitalize()
                csharp_code += f'    public {nested_class_name} {key.capitalize()} {{ get; set; }}\n'
                write_nested_class(nested_class_name, value)  # Write nested class as a separate file
            elif isinstance(value, list):
                if value and isinstance(value[0], dict):  # List of objects
                    nested_class_name = key.capitalize()[:-1]
                    csharp_code += f'    public List<{nested_class_name}> {key.capitalize()} {{ get; set; }}\n'
                    write_nested_class(nested_class_name, value[0])  # Write nested class as a separate file
                else:
                    list_type = get_csharp_type(value[0]) if value else 'object'
                    csharp_code += f'    public List<{list_type}> {key.capitalize()} {{ get; set; }}\n'
            else:
                csharp_code += f'    public {property_type} {key.capitalize()} {{ get; set; }}\n'
    else:
        # If the root data is not a dictionary, treat it as a single value class
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

# Function to write each class to a separate file
def write_nested_class(class_name, data):
    csharp_code = generate_csharp_class(class_name, data)
    output_file_path = os.path.join(output_directory, f'{class_name}.cs')
    
    with open(output_file_path, 'w') as cs_file:
        cs_file.write(csharp_code)

# Function to clear the output directory
def clear_output_directory(directory):
    if os.path.exists(directory):
        shutil.rmtree(directory)  # Delete the folder and all its contents
    os.makedirs(directory, exist_ok=True)  # Recreate the directory

# Main script execution

# Check if the script is provided with a JSON file as an argument
if len(sys.argv) < 2:
    print("Error: Please specify the JSON file as an argument.")
    sys.exit(1)

# Get the JSON file path from command-line arguments
input_file = sys.argv[1]

# Paths for input and output directories
output_directory = 'csharp-model'

# Clear the output directory before generating new files
clear_output_directory(output_directory)

# Read the JSON file
try:
    with open(input_file, 'r') as file:
        json_data = json.load(file)
except FileNotFoundError:
    print(f"Error: File '{input_file}' not found.")
    sys.exit(1)

# Determine if the root is an additional object (e.g., "company": {...}) or just the root object itself
if isinstance(json_data, dict) and len(json_data) == 1:
    # If there's only one key, treat it as the main class
    root_key = list(json_data.keys())[0]  # Get the first (and only) key
    root_data = json_data[root_key]       # Get the data of the root key
    base_class_name = root_key.capitalize()
else:
    # If the root is directly the object (e.g., in `user.json`)
    base_class_name = os.path.splitext(os.path.basename(input_file))[0].capitalize()
    root_data = json_data

# Generate the C# class structure for the base class
base_class_code = generate_csharp_class(base_class_name, root_data)

# Output the base C# class to a .cs file in the csharp-model directory
output_file_path = os.path.join(output_directory, f'{base_class_name}.cs')

with open(output_file_path, 'w') as cs_file:
    cs_file.write(base_class_code)

print(f'C# class {base_class_name} written to {output_file_path}')