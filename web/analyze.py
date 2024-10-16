from flask import Blueprint, request, jsonify
from anytree import Node, RenderTree

analyze_bp = Blueprint('analyze_bp', __name__)

# Function to build the tree from the JSON
def build_tree(data, parent=None):
    if isinstance(data, dict):  
        for key, value in data.items():
            if isinstance(value, list):  
                node = Node(f'{key} [ ]', parent=parent) 
                if value:  
                    build_tree(value[0], node)
            else:
                node = Node(key, parent=parent)  #
                build_tree(value, node)  
    elif isinstance(data, list):  
        pass  


@analyze_bp.route('/analyze', methods=['POST'])

def process_json():
    json_data = request.get_json()  # Get JSON from the request

    root = Node("root")
    
    try:
        if not json_data:
            return jsonify({"error":"No JSON data received"}), 400
        build_tree(json_data, root)
    except Exception as e:
        return jsonify({"error": str(e)}), 500  # return error details

    # Create the tree as a string
    tree_output = ""
    for pre, fill, node in RenderTree(root):
        tree_output += f"{pre}{node.name}\n"

    # Return the tree structure as a response
    return jsonify({"tree": tree_output}), 200

if __name__ == "__main__":
    analyze_bp.run(debug=True)
