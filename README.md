# JSON to C# Class and Tree Structure Generator

This project provides tools to generate both C# class files and a tree structure representing the hierarchy of a given JSON schema. It includes:

- A batch file (`run-json2cs.bat`) that generates C# class files and a tree structure from a JSON file selected via a File Explorer dialog.
- A web-based interface that allows you to input JSON, analyze it, and view the hierarchical tree structure in the browser.

## Features

- **Batch File (`run-json2cs.bat`)**:

  - Automatically generates C# class files from a JSON schema.
  - Produces a hierarchical tree structure from the JSON file.
  - Allows you to select the JSON file through a File Explorer dialog.
  - Creates an output folder inside `csharp-model` named after the root element in the JSON file or the file name itself.
  - Organizes the tree structure file `schema-tree.txt` in a `tree` subdirectory within the C# output folder.
  - Opens the output folder for easy access to both the C# files and the tree structure.

- **Web-based JSON Analyzer**:
  - Provides a user interface for analyzing JSON files.
  - Displays the JSON tree structure in the browser.
  - Uses Flask as the backend to process and render the JSON tree structure.
  - Supports Cross-Origin Resource Sharing (CORS) for easy communication between frontend and backend.

## Batch File Usage

### Prerequisites

- Python 3.x installed on your machine.
- The following Python libraries are required:
  - `anytree` for generating and rendering the tree structure.

Install the required library using pip:

```bash
pip install anytree
```

### Running the Batch File

1. Clone the repository or download the Python scripts and batch file.
2. Double-click the `run-json2cs.bat` batch fle to run the script.
3. File explorer will open and you will need to navigate to the json file you want to analyze.
4. Double click to the json file.
5. After processing the anaylsis, the folder with the artifacts (C# classes representing the model and the tree folder with the tree of the schema) will open.

### Example

If the input file is user.json with the following content:

```json
{
  "user": {
    "name": "John Doe",
    "age": 30,
    "email": "johndoe@example.com",
    "address": {
      "street": "123 Main St",
      "city": "New York",
      "state": "NY",
      "zip": "10001"
    },
    "phoneNumbers": [
      {
        "type": "home",
        "number": "212-555-1234"
      },
      {
        "type": "work",
        "number": "646-555-5678"
      }
    ],
    "isActive": true,
    "roles": ["admin", "editor", "user"]
  }
}
```

The script will create a folder named `user` inside the `csharp-model` directory and generate the following C# class files in it.

- `User.cs`
- `Address.cs`
- `Phonenumber.cs`

### `User.cs` Example Output

```csharp
public class User
{
    public string Name { get; set; }
    public int Age { get; set; }
    public string Email { get; set; }
    public Address Address { get; set; }
    public List<Phonenumber> Phonenumbers { get; set; }
    public bool Isactive { get; set; }
    public List<string> Roles { get; set; }
}
```

## Web-Based JSON Analyzer Usage

### Prerequisites

- Python 3.x installed on your machine.
- The following Python libraries are required:
  - `flask`
  - `flask-cors`
  - `anytree`

Install the requited libraries using pip:

```bash
pip install flask flask-cors anytree
```

### Running the Flask Server

1. Navigate to the project directory.
2. Run the Flask server:

```bash
python json-2-tree-direct.py
```

The Flask server should now be running on http://127.0.0.1:5000.

### Opening the Frontend

1. Open the `json-analyzer.html` file in a browser.
2. Paste a valid JSON object into the Input JSON text box.
3. Click the Analyze button to submit the JSON.
4. The hierarchical structure (tree) of the JSON will appear in the `Output JSON` text box.

## License

This project is licensed under the MIT License. See the [LICENSE](./LICENSE) file for details.
