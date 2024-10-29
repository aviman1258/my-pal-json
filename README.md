# My Pal JSON

My Pal JSON is a web-based JSON analyzer that allows users to test APIs, view request and response data, toggle between dark and light themes, and generate code based on JSON input. It supports multiple programming languages and includes dynamic header management and easy request-response toggling.

## Quick Start

### Without Downloading the Code

1. Set up the buildx builder:

   ```bash
   docker buildx create --use
   ```

2. Build and push the Docker image:

   ```bash
   docker buildx build --platform linux/amd64,linux/arm64 -t achandra1258/my-pal-json:1.3.0 -t achandra1258/my-pal-json:latest --push .
   ```

3. Pull the latest Docker image:

   ```bash
   docker pull achandra1258/my-pal-json:latest
   ```

4. Run the Docker container:

   ```bash
   docker run --name my-pal-json-server-app -d -p 5000:5000 achandra1258/my-pal-json:latest
   ```

5. Open your browser and go to [localhost:5000](http://localhost:5000) to access My Pal JSON.

### With Code Downloaded

1. Clone the repository and navigate to the project directory.
2. Start the application using Docker Compose:
   ```bash
   docker-compose up -d
   ```

## How to Use

### Features

- **API Testing**: Send API requests with custom HTTP methods, headers, and JSON body input.
- **Response Viewer**: View API responses directly in the response tab.
- **Request/Response Tabs**: Toggle between "Request" and "Response" views, making it easy to switch and review data.
- **Dynamic Headers Management**: Add custom headers, including support for `Authorization` tokens.
- **Code Generation**: Generate code in multiple languages (C#, Python, JavaScript, C++, Java, Go) based on JSON input.
- **Theme Toggle**: Switch between light and dark themes to match your preference.

### Usage Instructions

1. **API Request Setup**:

   - Select your HTTP method (`GET`, `POST`, or `PUT`) from the dropdown.
   - Enter the API endpoint in the URL input field.
   - If needed, enter a JSON payload in the input area under the "Request" tab.

2. **Header Management**:

   - Add custom headers in the header section. If the header key is `Authorization`, the application will automatically add the `Bearer` prefix if needed.

3. **Sending a Request**:

   - Click the "Send" button to submit the API request.
   - Once a response is received, it will display in the "Response" tab, and the tab will switch automatically to show the output.

4. **Tab Switching**:

   - Switch between "Request" and "Response" tabs to view either your input JSON or the API response JSON.

5. **Analyze Json Structure**

   - See the json schema structure in s simple tree format.

6. **Code Generation**:

   - Choose your preferred programming language from the dropdown menu and click "Model" to generate code based on your JSON input.

7. **Theme Toggle**:
   - Click the theme toggle button to switch between light and dark modes.

Enjoy analyzing and testing your JSON data with My Pal JSON!
