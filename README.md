
# JSON to C# Class Generator

This project provides a batch file `run-json2cs.bat` that allows you to select a JSON file using File Explorer and generates corresponding C# class files. The generated classes are placed in a folder under `csharp-model`, with the folder name based on the root element of the JSON. If the JSON has no clear root element, the folder name will be based on the JSON file name.

## Features

- Automatically generates C# class files from a JSON schema.
- Handles nested objects and lists, generating separate class files for each.
- Allows you to select the JSON file through a File Explorer dialog.
- Creates an output folder inside `csharp-model` named after the root element in the JSON file or the file name itself.
- Cleans the generated folder before creating new files.

## Usage

### Prerequisites

- Python 3.x installed on your machine.

### Running the Batch File
1. Clone the repository or download the Python script and batch file.
2. Double-click the `run-json2cs.bat` batch fle to run the script

### Process:
1. The batch file will prompt you to **press any key** to open File Explorer.
2. Navigate to the JSON file you want to analyze and select double click it.
3. The batch file will run the Python script, which will process the selected JSON file and generate corresponding C# class files.
4. The generated class files will be placed in a folder inside `csharp-model` named after the root element of the JSON file (or the file name if no root element exists).
5. The folder containing the generated class files will open automatically once the process is completed.

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