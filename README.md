# Zilliqa MCP Server

A comprehensive Model Context Protocol (MCP) server that provides access to Zilliqa blockchain documentation, API examples, address conversion tools, faucet integration, live network statistics, and automatic content fetching from source URLs.

## Installation

### Using Local Development Version

Clone this repository and build the local instance:

```bash
git clone https://github.com/Zilliqa/zilliqa-experimental.git
cd zilliqa-experimental/lama/zilliqa-mcp
npm install
npm run build
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

## Claude Desktop Integration

Add this to your Claude Desktop MCP configuration:

```json
{
  "mcpServers": {
    "zilliqa": {
      "command": "node",
      "args": ["/path/to/zilliqa-experimental/lama/zilliqa-mcp/build/index.js"]
    }
  }
}
```

Replace `/path/to/zilliqa-experimental` with the actual path where you cloned the repository.

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

## Development

### Local Development
```bash
git clone https://github.com/Zilliqa/zilliqa-experimental.git
cd zilliqa-experimental/lama/zilliqa-mcp
npm install
npm run build
npm run dev
```

### HTTP Server Mode
For development and testing, you can run the server in HTTP mode:
```bash
MCP_TRANSPORT=http npm start
```
This runs the server on port 3000 with CORS enabled for testing.

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
```

## License

MIT