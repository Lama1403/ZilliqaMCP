# Zilliqa MCP Server

A Model Context Protocol (MCP) server that provides access to Zilliqa blockchain documentation and API examples.

## Features

- **search_zilliqa_docs** - Search through Zilliqa documentation for specific topics
- **get_zilliqa_api_example** - Get specific API examples by name and programming language  
- **list_zilliqa_apis** - List all available API methods in the documentation

## Usage

### Local Development (stdio)
```bash
npm install
npm run build
npm run start:local
```

### HTTP Server (for external access)
```bash
npm install
npm run build
npm run dev:http  # Development
npm run start     # Production
```

### Claude Desktop Integration

**Local stdio mode:**
```json
{
  "mcpServers": {
    "zilliqa": {
      "command": "node",
      "args": ["/path/to/ZilliqaMCP/build/index.js"]
    }
  }
}
```

**HTTP mode (for deployed server):**
```json
{
  "mcpServers": {
    "zilliqa": {
      "command": "npx",
      "args": ["@modelcontextprotocol/client", "http://your-server-url"]
    }
  }
}
```

## Deployment

### Railway
1. Connect this GitHub repository to Railway
2. Railway will automatically detect the `railway.toml` configuration
3. Deploy and get your server URL

### Render
1. Connect this GitHub repository to Render
2. Render will use the `render.yaml` configuration
3. Deploy and get your server URL

### Manual Deployment
Set environment variables:
- `NODE_ENV=production` (enables HTTP mode)
- `PORT=3000` (or your preferred port)

## API Examples

The server includes comprehensive Zilliqa API documentation with examples in:
- Java
- Python  
- Go
- Node.js
- cURL

Access patterns include blockchain APIs, transaction handling, and smart contract interactions.