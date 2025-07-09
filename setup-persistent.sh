#!/bin/bash

echo "🚀 Setting up persistent Zilliqa MCP server..."

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo "📦 Installing PM2..."
    npm install -g pm2
fi

# Build the project
echo "🔨 Building project..."
npm run build

# Stop existing PM2 process if running
pm2 stop zilliqa-mcp 2>/dev/null

# Start with PM2
echo "▶️  Starting MCP server with PM2..."
pm2 start build/index.js --name zilliqa-mcp --watch build

# Save PM2 configuration
echo "💾 Saving PM2 configuration..."
pm2 save

# Setup startup script
echo "🔧 Setting up auto-start on boot..."
echo "Please run the following command if prompted:"
pm2 startup

echo "✅ Setup complete!"
echo ""
echo "Useful commands:"
echo "  pm2 status          - Check server status"
echo "  pm2 logs zilliqa-mcp - View logs"
echo "  pm2 restart zilliqa-mcp - Restart server"
echo "  npm run build && pm2 restart zilliqa-mcp - Rebuild and restart"
echo ""
echo "Your MCP server is now running persistently!"