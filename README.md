# Zilliqa MCP Server

A Model Context Protocol (MCP) server that provides access to Zilliqa blockchain documentation and API examples.

## Installation

```bash
npm install -g zilliqa-mcp-server
```

## Features

- **search_zilliqa_docs** - Search through Zilliqa documentation for specific topics
- **get_zilliqa_api_example** - Get specific API examples by name and programming language  
- **list_zilliqa_apis** - List all available API methods in the documentation

## Claude Desktop Integration

Add this to your Claude Desktop MCP configuration:

```json
{
  "mcpServers": {
    "zilliqa": {
      "command": "npx",
      "args": ["-y", "zilliqa-mcp-server"]
    }
  }
}
```

### Configuration File Location

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux:** `~/.config/Claude/claude_desktop_config.json`

## Usage Examples

After installation and configuration, you can use these tools in Claude:

- "Search Zilliqa docs for GetBalance"
- "Get API example for GetTransaction in Python"
- "List all available Zilliqa APIs"

## API Documentation

The server includes comprehensive Zilliqa API documentation with examples in:
- Java
- Python  
- Go
- Node.js
- cURL

Access patterns include blockchain APIs, transaction handling, and smart contract interactions.

## Development

### Local Development
```bash
git clone https://github.com/Lama1403/ZilliqaMCP.git
cd ZilliqaMCP
npm install
npm run build
npm run dev
```

### Testing
```bash
npm test
```

## License

MIT