# Zilliqa MCP Server

A comprehensive Model Context Protocol (MCP) server that provides access to Zilliqa blockchain documentation, API examples, address conversion tools, faucet integration, live network statistics, and automatic content fetching from source URLs.

## Understanding Server Modes

This MCP server can run in two modes:

1. **HTTP Mode (Default)** - For web access, API calls, and cloud deployment
   - Accessible via `http://localhost:PORT`
   - Can be deployed to Render, Railway, etc.
   - Supports CORS for cross-origin requests
   - Cannot be used with Claude Desktop

2. **STDIO Mode** - For Claude Desktop integration only
   - Communicates through standard input/output
   - Required for Claude Desktop
   - Cannot be accessed via HTTP
   - Set with `MCP_TRANSPORT=stdio`

⚠️ **Important**: These modes are mutually exclusive. A server running in HTTP mode cannot communicate with Claude Desktop, and vice versa.

## Quick Start

### 1. Installation

```bash
git clone https://github.com/Zilliqa/zilliqa-experimental.git
cd zilliqa-experimental/lama/zilliqa-mcp
npm install
npm run build
```

### 2. Run the Server

```bash
# Run on default port 3000
npm start

# Or specify a custom port
PORT=3010 npm start
```

The server will run in HTTP mode by default and be available at `http://localhost:3000` (or your specified port).

⚠️ **Warning**: Running `npm start` will NOT make the server available to Claude Desktop. For Claude Desktop integration, see the [Claude Desktop Integration](#alternative-claude-desktop-integration) section below.

### 3. Test the Server

```bash
# Check if server is running
curl http://localhost:3000/

# List available tools
curl -X POST http://localhost:3000/ \
  -H "Content-Type: application/json" \
  -d '{"method": "tools/list", "params": {}}'
```

## Features

### Documentation & API Access
- **search_zilliqa_docs** - Search through Zilliqa documentation for specific topics
- **get_zilliqa_api_example** - Get specific API examples by name and programming language  
- **list_zilliqa_apis** - List all available API methods in the documentation
- **get_zilliqa_network_info** - Get network information (RPC URLs, chain IDs, explorers, faucets)

### Address Conversion Tools
- **convert_zilliqa_address** - Convert between bech32 (zil1...) and hex address formats
- **validate_zilliqa_address** - Validate Zilliqa address format without conversion
- **batch_convert_zilliqa_addresses** - Convert multiple addresses at once (up to 100 addresses)

### Faucet Integration
- **request_zilliqa_faucet** - Request test ZIL tokens from devnet/testnet faucets (100 ZIL per request)

### Network Statistics
- **get_network_stats** - Get live network statistics for mainnet, testnet, and devnet
  - Latest block information (number, timestamp, gas usage)
  - Network status and configuration
  - Real-time blockchain metrics

### Staking Portal Information
- **get_staking_portal_info** - Get comprehensive information about Zilliqa 2.0 staking portal (stake.zilliqa.com)
  - Overview of staking portal features and functionality
  - Liquid staking vs non-liquid staking options
  - Validator selection guidance and considerations
  - Step-by-step staking instructions
  - Staking requirements and minimum amounts
  - Rewards information and claiming process

### Smart Content Fetching
- **Universal Source URL Fetching** - Automatically fetches and includes live content from any source URLs mentioned in documentation
- **Enhanced Content Extraction** - Intelligently extracts main content from various website structures
- **Real-time Documentation** - Always provides up-to-date information by fetching from original sources

## Production Deployment

This server is designed for easy deployment to cloud platforms:

### Deploy to Render (Recommended)

1. Push your code to GitHub
2. Connect your repository to Render
3. The included `render.yaml` will automatically configure:
   - HTTP mode with environment variables
   - Node.js runtime
   - Build and start commands
4. Your MCP server will be available at `https://your-app.onrender.com`

### Deploy to Railway

1. Push your code to GitHub
2. Connect your repository to Railway
3. The included `railway.toml` handles configuration
4. Get your public URL from Railway dashboard

### Environment Variables

For production deployment, you can set:
```bash
NODE_ENV=production
PORT=3000  # Or your preferred port
```

The server runs in HTTP mode by default. No need to set `MCP_TRANSPORT` unless you want STDIO mode.

## Alternative: Claude Desktop Integration

⚠️ **Important**: Claude Desktop only supports STDIO mode, not HTTP. If you want to use this MCP server with Claude Desktop, you must configure it for STDIO mode:

```json
{
  "mcpServers": {
    "zilliqa": {
      "command": "node",
      "args": ["/path/to/zilliqa-experimental/lama/zilliqa-mcp/build/index.js"],
      "env": {
        "MCP_TRANSPORT": "stdio"  // Required for Claude Desktop
      }
    }
  }
}
```

Replace `/path/to/zilliqa-experimental` with the actual path where you cloned the repository.

⚠️ **Common Mistake**: Without `"MCP_TRANSPORT": "stdio"` in the config, the server will start in HTTP mode and Claude Desktop will fail to connect. You'll see the server running but Claude won't be able to use it.

### Configuration File Location

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux:** `~/.config/Claude/claude_desktop_config.json`

## Usage Examples

After installation and configuration, you can use these tools in Claude:

### Documentation & API Examples
- "Search Zilliqa docs for GetBalance"
- "Get API example for GetTransaction in Python"
- "List all available Zilliqa APIs"
- "Get devnet network information"

### Address Conversion
- "Convert this address to hex: zil1abc123..."
- "Validate this Zilliqa address: 0x123abc..."
- "Convert these addresses in batch: [zil1abc..., 0x123...]"

### Faucet Requests
- "Request devnet tokens for zil1abc123..."
- "Get testnet ZIL for my address"

### Network Statistics
- "Get mainnet network statistics"
- "Show testnet network stats"
- "Get devnet blockchain metrics"

### Staking Portal Information
- "Get staking portal overview"
- "Tell me about liquid staking options"
- "How do I stake on Zilliqa 2.0?"
- "What are the staking requirements?"
- "Explain validator selection process"
- "How do I claim staking rewards?"

### Smart Features
- All responses automatically include live content from source URLs
- Documentation is always up-to-date with latest information
- Addresses are automatically formatted in code blocks for easy copying

## Technical Details

### Supported Networks
- **Devnet** - Development network with latest features (Chain ID: 33103)
- **Testnet** - Stable testing environment (Chain ID: 33101)  
- **Mainnet** - Production network (Chain ID: 32769)

### Address Formats
- **Bech32** - Human-readable format (zil1...) - recommended for user interfaces
- **Hex** - Machine-readable format (40 characters, with/without 0x prefix)
- **Validation** - Comprehensive format checking with detailed error messages

### API Documentation
The server includes comprehensive Zilliqa API documentation with examples in:
- Java
- Python  
- Go
- Node.js
- cURL

Access patterns include blockchain APIs, transaction handling, and smart contract interactions.

### Smart Content Features
- **Universal URL Detection** - Automatically detects any HTTP/HTTPS URL in documentation
- **Content Extraction** - Intelligently extracts main content from various website structures
- **Fallback Mechanisms** - Graceful handling when content cannot be fetched
- **Live Documentation** - Always provides current information from original sources

### Network Statistics Sample Output
```
**Mainnet Network Statistics**

**Latest Block:**
- Block Number: 5474727
- Timestamp: 2025-07-08T15:49:58.395Z
- Gas Limit: 200000
- Gas Used: 0
- Transaction Count: 64

**Network Info:**
- Network ID: 1
- Chain ID: 32769
- Status: 🟢 Online

**Configuration:**
- RPC URL: https://api.zilliqa.com
- Explorer: https://explorer.zilliqa.com
```

## Persistent Local Setup with PM2

For a persistent local server that auto-restarts and survives system reboots, you can use PM2:

### Installing PM2

```bash
npm install -g pm2
```

### Starting with PM2

```bash
# Start the MCP server with PM2
pm2 start build/index.js --name zilliqa-mcp

# Or with custom port
pm2 start build/index.js --name zilliqa-mcp --env PORT=3010

# View logs
pm2 logs zilliqa-mcp

# Monitor status
pm2 status
```

### PM2 Management Commands

```bash
# Stop the server
pm2 stop zilliqa-mcp

# Restart the server
pm2 restart zilliqa-mcp

# Remove from PM2
pm2 delete zilliqa-mcp

# Save PM2 configuration
pm2 save

# Setup auto-start on system boot
pm2 startup
```

### Why Use PM2?

- **Auto-restart** on crashes
- **Persistent** across terminal sessions
- **System startup** integration
- **Log management** with rotation
- **Process monitoring** built-in

**Note**: PM2 is optional. For development, running directly with `npm start` is fine. For production deployment to Render/Railway, PM2 is not needed as these platforms handle process management.

## Development

### Running in Development Mode

```bash
# Using tsx for hot-reloading during development
npm run dev
```

### Making HTTP Requests

Example requests to test your server:

```bash
# Convert an address
curl -X POST http://localhost:3000/ \
  -H "Content-Type: application/json" \
  -d '{
    "method": "tools/call",
    "params": {
      "name": "convert_zilliqa_address",
      "arguments": {"address": "zil1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq9yf6pz"}
    }
  }'

# Get network statistics
curl -X POST http://localhost:3000/ \
  -H "Content-Type: application/json" \
  -d '{
    "method": "tools/call",
    "params": {
      "name": "get_network_stats",
      "arguments": {"network": "mainnet"}
    }
  }'
```

### Testing
```bash
npm test
```

### Project Structure
```
src/
├── index.ts          # Main MCP server implementation
├── LLMtext/          # Documentation files
│   ├── ZilliqaBlockcahin.txt
│   ├── ZilliqaDevDocs.txt
│   └── ...
build/                # Compiled JavaScript files
render.yaml           # Render deployment config
railway.toml          # Railway deployment config
```

### Security Considerations for Public Deployment

When deploying publicly, consider adding:
- Authentication (API keys or OAuth)
- Rate limiting to prevent abuse
- Request logging for monitoring
- CORS configuration for specific domains
- Input validation (already included)

## Troubleshooting

### Claude Desktop Can't Find the MCP Server

If Claude Desktop shows the Zilliqa tools are unavailable:

1. **Check your config has STDIO mode enabled**:
   ```json
   "env": {
     "MCP_TRANSPORT": "stdio"  // This line is required!
   }
   ```

2. **Verify the server starts in STDIO mode**:
   ```bash
   # Test your config
   MCP_TRANSPORT=stdio node /path/to/build/index.js
   # Should output: "Zilliqa MCP Server running on stdio"
   ```

3. **Check Claude Desktop logs**:
   ```bash
   # macOS
   tail -f ~/Library/Logs/Claude/mcp-server-zilliqa.log
   ```

### Server Runs but Claude Can't Use It

This usually means the server is running in HTTP mode instead of STDIO:
- ❌ Output: "Zilliqa MCP Server running on HTTP port 3000"
- ✅ Output: "Zilliqa MCP Server running on stdio"

### Can't Access HTTP Server from Browser

If you're trying to access the HTTP server:
- Make sure you're NOT using `MCP_TRANSPORT=stdio`
- Default URL is `http://localhost:3000` (not HTTPS)
- Check if another process is using the port

## License

MIT