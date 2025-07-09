# Persistent MCP Server Setup

This guide shows how to keep your Zilliqa MCP server running without rebuilding every time.

## Option 1: Using PM2 (Recommended for Development)

PM2 is a process manager that keeps your Node.js applications running.

### Installation
```bash
npm install -g pm2
```

### Setup
```bash
# Build once
cd /Users/zilliqa/Desktop/Github/zilliqa-experimental/lama/zilliqa-mcp
npm run build

# Start with PM2
pm2 start build/index.js --name zilliqa-mcp

# Save PM2 configuration
pm2 save

# Set PM2 to start on boot
pm2 startup
# Follow the command it outputs
```

### PM2 Commands
```bash
pm2 status           # Check if running
pm2 logs zilliqa-mcp # View logs
pm2 restart zilliqa-mcp # Restart server
pm2 stop zilliqa-mcp # Stop server
```

## Option 2: Using nodemon (For Active Development)

Nodemon automatically restarts when you make changes.

### Installation
```bash
npm install -g nodemon
```

### Add to package.json scripts
```json
{
  "scripts": {
    "dev:watch": "nodemon --watch src --ext ts --exec 'npm run build && node build/index.js'"
  }
}
```

### Run
```bash
npm run dev:watch
```

## Option 3: macOS LaunchAgent (Automatic Start on Boot)

### Create LaunchAgent
```bash
# Create the plist file
cat > ~/Library/LaunchAgents/com.zilliqa.mcp.plist << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.zilliqa.mcp</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>/Users/zilliqa/Desktop/Github/zilliqa-experimental/lama/zilliqa-mcp/build/index.js</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/zilliqa-mcp.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/zilliqa-mcp.error.log</string>
</dict>
</plist>
EOF

# Load the agent
launchctl load ~/Library/LaunchAgents/com.zilliqa.mcp.plist
```

### LaunchAgent Commands
```bash
# Check status
launchctl list | grep zilliqa

# Stop
launchctl unload ~/Library/LaunchAgents/com.zilliqa.mcp.plist

# Start
launchctl load ~/Library/LaunchAgents/com.zilliqa.mcp.plist

# View logs
tail -f /tmp/zilliqa-mcp.log
tail -f /tmp/zilliqa-mcp.error.log
```

## Option 4: Quick Development Script

Create a start script that handles everything:

### Create start.sh
```bash
#!/bin/bash
cd /Users/zilliqa/Desktop/Github/zilliqa-experimental/lama/zilliqa-mcp

# Check if already running
if pgrep -f "zilliqa-mcp/build/index.js" > /dev/null; then
    echo "MCP server already running"
else
    echo "Building and starting MCP server..."
    npm run build
    nohup node build/index.js > mcp.log 2>&1 &
    echo "MCP server started. PID: $!"
    echo $! > mcp.pid
fi
```

Make it executable:
```bash
chmod +x start.sh
```

### Create stop.sh
```bash
#!/bin/bash
if [ -f mcp.pid ]; then
    kill $(cat mcp.pid)
    rm mcp.pid
    echo "MCP server stopped"
else
    echo "No PID file found"
fi
```

## Option 5: Using screen/tmux

For quick sessions without installation:

```bash
# Using screen
screen -S mcp
cd /Users/zilliqa/Desktop/Github/zilliqa-experimental/lama/zilliqa-mcp
npm run build && node build/index.js
# Detach with Ctrl+A, D

# Reattach
screen -r mcp

# Using tmux
tmux new -s mcp
cd /Users/zilliqa/Desktop/Github/zilliqa-experimental/lama/zilliqa-mcp
npm run build && node build/index.js
# Detach with Ctrl+B, D

# Reattach
tmux attach -t mcp
```

## Recommended Setup for You

Since you're actively developing, I recommend:

1. **PM2 for persistent running**:
   ```bash
   npm install -g pm2
   cd /Users/zilliqa/Desktop/Github/zilliqa-experimental/lama/zilliqa-mcp
   npm run build
   pm2 start build/index.js --name zilliqa-mcp --watch build
   pm2 save
   pm2 startup
   ```

2. **Development workflow**:
   - Make changes to TypeScript files
   - Run `npm run build` to compile
   - PM2 will auto-restart with `--watch` flag

3. **Check Claude Desktop config** is pointing to the right location:
   ```json
   {
     "mcpServers": {
       "zilliqa": {
         "command": "node",
         "args": ["/Users/zilliqa/Desktop/Github/zilliqa-experimental/lama/zilliqa-mcp/build/index.js"]
       }
     }
   }
   ```

## Troubleshooting

### Server not connecting
1. Check if process is running: `ps aux | grep zilliqa-mcp`
2. Check logs: `pm2 logs zilliqa-mcp` or `/tmp/zilliqa-mcp.log`
3. Rebuild: `npm run build`
4. Restart Claude Desktop app

### After system restart
- PM2: Should auto-start if you ran `pm2 startup`
- LaunchAgent: Should auto-start
- Others: Need manual start

## Quick Commands Reference

```bash
# Check if running
ps aux | grep zilliqa-mcp

# Quick rebuild and restart with PM2
cd /Users/zilliqa/Desktop/Github/zilliqa-experimental/lama/zilliqa-mcp && npm run build && pm2 restart zilliqa-mcp

# View real-time logs
pm2 logs zilliqa-mcp --lines 50
```