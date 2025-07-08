#!/usr/bin/env node

const http = require('http');
const https = require('https');
const { URL } = require('url');

const SERVER_URL = 'https://zilliqa-mcp-server-production.up.railway.app/';

class HttpMcpClient {
  constructor() {
    this.setupStdio();
  }

  setupStdio() {
    process.stdin.setEncoding('utf8');
    process.stdin.on('readable', () => {
      let chunk;
      while (null !== (chunk = process.stdin.read())) {
        this.handleMessage(chunk.trim()).catch(console.error);
      }
    });
  }

  async handleMessage(message) {
    if (!message) return;

    try {
      const request = JSON.parse(message);
      const response = await this.sendRequest(request);
      console.log(JSON.stringify(response));
    } catch (error) {
      console.log(JSON.stringify({
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32603,
          message: error.message
        }
      }));
    }
  }

  async sendRequest(data) {
    return new Promise((resolve, reject) => {
      const url = new URL(SERVER_URL);
      const postData = JSON.stringify(data);

      const options = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const req = (url.protocol === 'https:' ? https : http).request(options, (res) => {
        let responseData = '';

        res.on('data', (chunk) => {
          responseData += chunk;
        });

        res.on('end', () => {
          try {
            const response = JSON.parse(responseData);
            resolve(response);
          } catch (error) {
            reject(new Error(`Invalid JSON response: ${responseData}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.write(postData);
      req.end();
    });
  }
}

const client = new HttpMcpClient();

// Handle graceful shutdown
process.on('SIGINT', () => {
  process.exit(0);
});

process.on('SIGTERM', () => {
  process.exit(0);
});