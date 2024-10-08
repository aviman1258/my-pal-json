from flask import Flask, request, jsonify
from flask_cors import CORS
from anytree import Node, RenderTree

app = Flask(__name__)
CORS(app)  # This will enable CORS for all routes

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

# Root route to check server status
@app.route('/')
def index():
    return "Flask server is running. Use the /process-json endpoint to send JSON."

@app.route('/process-json', methods=['POST'])
def process_json():
    print("hello")
    json_data = request.get_json()  # Get JSON from the request
    print(f"Received JSON: {json_data}")  # Debugging line

    # Create the root node based on the entire JSON structure
    root = Node("root")
    
    try:
        build_tree(json_data, root)
        print("Tree building successful")  # Debugging line
    except Exception as e:
        print(f"Error while building tree: {e}")  # Print error details

    # Create the tree as a string
    tree_output = ""
    for pre, fill, node in RenderTree(root):
        tree_output += f"{pre}{node.name}\n"
        print(f"Tree Node: {pre}{node.name}")  # Debugging line

    # Return the tree structure as a response
    return jsonify({"tree": tree_output})

if __name__ == "__main__":
    app.run(debug=True)
