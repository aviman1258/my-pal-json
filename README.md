
# JSON to C# Class and Tree Structure Generator

This project provides a batch file `run-json2cs.bat` that allows you to select a JSON file via a File Explorer dialog. The batch file will then:

1. Run the `json-2-csharp-model.py` script to generate corresponding C# class files based on the structure of the JSON file.
2. Run the `json-2-tree.py` script to generate a tree structure `schema-tree.txt` showing the hierarchy of the JSON keys.
3. Open the directory containing both the C# files and the tree structure after the process is complete.

## Features

- Automatically generates C# class files from a JSON schema.
- Produces a hierarchical tree structure from the JSON file.
- Allows you to select the JSON file through a File Explorer dialog.
- Creates an output folder inside `csharp-model` named after the root element in the JSON file or the file name itself.
- Organizes the tree structure file `schema-tree.txt` in a tree subdirectory within the C# output folder.
- Opens the output folder for easy access to both the C# files and the tree structure.

## Usage

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

## License
This project is licensed under the MIT License. See the [LICENSE](./LICENSE) file for details.