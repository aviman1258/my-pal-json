import json
from anytree import Node, RenderTree

# Function to build the tree from the JSON
def build_tree(data, parent=None):
    if isinstance(data, dict):  # If it's a dictionary, process keys as nodes
        for key, value in data.items():
            node = Node(key, parent=parent)
            build_tree(value, node)  # Recursive call to process the value
    elif isinstance(data, list):  # If it's a list, process each item
        for i, item in enumerate(data):
            node = Node(f'Item {i}', parent=parent)
            build_tree(item, node)  # Recursive call to process each item
    else:
        # If it's a primitive value (string, int, etc.), create a node with the value
        Node(f'{data}', parent=parent)

# Load JSON data from a file
json_file = 'user.json'

with open(json_file, 'r') as file:
    json_data = json.load(file)

# Create the root node based on the root element of the JSON
root_name = list(json_data.keys())[0] if isinstance(json_data, dict) else "Root"
root = Node(root_name)
build_tree(json_data[root_name] if isinstance(json_data, dict) else json_data, root)

# Render the tree in a readable format
for pre, fill, node in RenderTree(root):
    print(f"{pre}{node.name}")
