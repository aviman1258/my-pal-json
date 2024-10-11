import json
import sys
from anytree import Node, RenderTree

# Function to build the tree from the JSON
def build_tree(data, parent=None):
    if isinstance(data, dict):  # If it's a dictionary, process keys as nodes
        for key, value in data.items():
            if isinstance(value, list):  # If it's a list, handle it specially
                node = Node(f'{key} [ ]', parent=parent)  # Append '[ ]' to the key name
                if value:  # Process only the first element if the list is not empty
                    build_tree(value[0], node)
            else:
                node = Node(key, parent=parent)  # Create a node for each key
                build_tree(value, node)  # Recursive call to process the value
    elif isinstance(data, list):  # If it's a list, this block will not be reached for the first element
        pass  # We handle lists inside the dict block, so no need to process them again here

# Main function to handle the command-line argument
def main():
    if len(sys.argv) < 2:
        print("Usage: python script.py <json_file>")
        sys.exit(1)

    json_file = sys.argv[1]

    # Load JSON data from the provided file
    try:
        with open(json_file, 'r') as file:
            json_data = json.load(file)
    except FileNotFoundError:
        print(f"Error: The file '{json_file}' was not found.")
        sys.exit(1)
    except json.JSONDecodeError:
        print(f"Error: The file '{json_file}' is not a valid JSON file.")
        sys.exit(1)

    # Create the root node based on the entire JSON structure
    root = Node("root")
    build_tree(json_data, root)

    # Write the tree (keys only) to a file
    output_file = 'schema-tree.txt'
    with open(output_file, 'w', encoding='utf-8') as f:
        for pre, fill, node in RenderTree(root):
            f.write(f"{pre}{node.name}\n")

    print(f"Tree structure (keys only, handling arrays) has been written to {output_file}")

if __name__ == "__main__":
    main()
