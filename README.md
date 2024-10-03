# JSON to C# Class Generator

This Python script reads a JSON file and generates corresponding C# class files. The generated classes are placed in a `csharp-model` directory, which is cleaned before every run. The script handles both flat and nested JSON structures, generating separate C# files for nested objects.

## Features

- Automatically generates C# class files from a JSON schema.
- Handles nested objects and lists, generating separate class files for each.
- Cleans the output directory (`csharp-model`) before generating new files.
- Accepts the JSON file as a command-line argument.

## Usage

### Prerequisites

- Python 3.x installed on your machine.

### Running the Script

1. Clone the repository or download the Python script.
2. Open a terminal/command prompt.
3. Run the following command:

```bash
python script.py path/to/your.json
```

For example, if your JSON file is located at json/company.json, the command would be:

```bash
python script.py json/company.json
```

### Output

The script generates C# class files in the **csharp-model** directory, which will be cleared before new files are created.

## Example

```json
{
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
```

The script will generate the following C# class files:

- **User.cs**
- **Address.cs**
- **Phonenumber.cs**

### User.cs Example Output

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

This project is licensed under the MIT License. See the LICENSE file for details.
