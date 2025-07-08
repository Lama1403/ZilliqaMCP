#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import * as fs from "fs";
import * as path from "path";
import * as http from "http";

const server = new Server(
  {
    name: "zilliqa-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

const DOCS_PATH = path.join(__dirname, "../src/LLMtext");

interface DocumentSection {
  title: string;
  description: string;
  source: string;
  language?: string;
  code?: string;
  content: string;
}

function parseDocumentSections(content: string): DocumentSection[] {
  const sections: DocumentSection[] = [];
  const sectionDelimiter = "----------------------------------------";
  const parts = content.split(sectionDelimiter);
  
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    
    const lines = trimmed.split("\n");
    let title = "";
    let description = "";
    let source = "";
    let language = "";
    let code = "";
    let inCodeBlock = false;
    let codeLines: string[] = [];
    
    for (const line of lines) {
      if (line.startsWith("TITLE: ")) {
        title = line.substring(7);
      } else if (line.startsWith("DESCRIPTION: ")) {
        description = line.substring(13);
      } else if (line.startsWith("SOURCE: ")) {
        source = line.substring(8);
      } else if (line.startsWith("LANGUAGE: ")) {
        language = line.substring(10);
      } else if (line === "```" && !inCodeBlock) {
        inCodeBlock = true;
      } else if (line === "```" && inCodeBlock) {
        inCodeBlock = false;
        code = codeLines.join("\n");
      } else if (inCodeBlock) {
        codeLines.push(line);
      }
    }
    
    if (title) {
      sections.push({
        title,
        description,
        source,
        language,
        code,
        content: trimmed
      });
    }
  }
  
  return sections;
}

function loadDocuments(): { blockchain: DocumentSection[], devDocs: DocumentSection[] } {
  const blockchainPath = path.join(DOCS_PATH, "ZilliqaBlockcahin.txt");
  const devDocsPath = path.join(DOCS_PATH, "ZilliqaDevDocs.txt");
  
  const blockchainContent = fs.readFileSync(blockchainPath, "utf-8");
  const devDocsContent = fs.readFileSync(devDocsPath, "utf-8");
  
  return {
    blockchain: parseDocumentSections(blockchainContent),
    devDocs: parseDocumentSections(devDocsContent)
  };
}

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "search_zilliqa_docs",
        description: "Search through Zilliqa documentation for specific topics or keywords",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query to find relevant documentation sections",
            },
            category: {
              type: "string",
              description: "Category to search in: 'blockchain', 'devdocs', or 'all'",
              enum: ["blockchain", "devdocs", "all"],
              default: "all",
            },
            language: {
              type: "string",
              description: "Filter by programming language (optional)",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "get_zilliqa_api_example",
        description: "Get specific API examples from Zilliqa documentation",
        inputSchema: {
          type: "object",
          properties: {
            api_name: {
              type: "string",
              description: "Name of the API method to get examples for",
            },
            language: {
              type: "string",
              description: "Programming language for the example (java, python, go, curl, node.js)",
            },
          },
          required: ["api_name"],
        },
      },
      {
        name: "list_zilliqa_apis",
        description: "List all available API methods in the Zilliqa documentation",
        inputSchema: {
          type: "object",
          properties: {
            category: {
              type: "string",
              description: "Category to list: 'blockchain', 'devdocs', or 'all'",
              enum: ["blockchain", "devdocs", "all"],
              default: "all",
            },
          },
        },
      },
      {
        name: "get_zilliqa_network_info",
        description: "Get Zilliqa network information including RPC URLs, chain IDs, explorer links, and faucet information",
        inputSchema: {
          type: "object",
          properties: {
            network: {
              type: "string",
              description: "The network to get information for",
              enum: ["devnet", "testnet", "mainnet"],
            },
          },
          required: ["network"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  try {
    const docs = loadDocuments();
    
    switch (name) {
      case "search_zilliqa_docs": {
        const { query, category = "all", language } = args as {
          query: string;
          category?: "blockchain" | "devdocs" | "all";
          language?: string;
        };
        
        let sections: DocumentSection[] = [];
        
        if (category === "all") {
          sections = [...docs.blockchain, ...docs.devDocs];
        } else if (category === "blockchain") {
          sections = docs.blockchain;
        } else if (category === "devdocs") {
          sections = docs.devDocs;
        }
        
        const results = sections.filter(section => {
          const matchesQuery = section.title.toLowerCase().includes(query.toLowerCase()) ||
                             section.description.toLowerCase().includes(query.toLowerCase()) ||
                             section.content.toLowerCase().includes(query.toLowerCase());
          
          const matchesLanguage = !language || section.language?.toLowerCase() === language.toLowerCase();
          
          return matchesQuery && matchesLanguage;
        });
        
        if (results.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `No documentation found for query: "${query}"${language ? ` in language: ${language}` : ""}`,
              },
            ],
          };
        }
        
        const response = results.map(section => 
          `**${section.title}**\n${section.description}\n\n${section.language ? `Language: ${section.language}\n` : ""}${section.code ? `\`\`\`${section.language}\n${section.code}\n\`\`\`` : ""}\n\nSource: ${section.source}\n`
        ).join("\n---\n\n");
        
        return {
          content: [
            {
              type: "text",
              text: response,
            },
          ],
        };
      }
      
      case "get_zilliqa_api_example": {
        const { api_name, language } = args as {
          api_name: string;
          language?: string;
        };
        
        const allSections = [...docs.blockchain, ...docs.devDocs];
        const apiSections = allSections.filter(section =>
          section.title.toLowerCase().includes(api_name.toLowerCase())
        );
        
        if (apiSections.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `No API examples found for: "${api_name}"`,
              },
            ],
          };
        }
        
        let filteredSections = apiSections;
        if (language) {
          filteredSections = apiSections.filter(section =>
            section.language?.toLowerCase() === language.toLowerCase()
          );
          
          if (filteredSections.length === 0) {
            return {
              content: [
                {
                  type: "text",
                  text: `No examples found for "${api_name}" in language: ${language}\n\nAvailable languages: ${Array.from(new Set(apiSections.map(s => s.language).filter(Boolean))).join(", ")}`,
                },
              ],
            };
          }
        }
        
        const response = filteredSections.map(section =>
          `**${section.title}**\n${section.description}\n\n${section.language ? `Language: ${section.language}\n` : ""}${section.code ? `\`\`\`${section.language}\n${section.code}\n\`\`\`` : ""}\n\nSource: ${section.source}\n`
        ).join("\n---\n\n");
        
        return {
          content: [
            {
              type: "text",
              text: response,
            },
          ],
        };
      }
      
      case "list_zilliqa_apis": {
        const { category = "all" } = args as {
          category?: "blockchain" | "devdocs" | "all";
        };
        
        let sections: DocumentSection[] = [];
        
        if (category === "all") {
          sections = [...docs.blockchain, ...docs.devDocs];
        } else if (category === "blockchain") {
          sections = docs.blockchain;
        } else if (category === "devdocs") {
          sections = docs.devDocs;
        }
        
        const apiList = sections.map(section => 
          `• **${section.title}**${section.language ? ` (${section.language})` : ""}\n  ${section.description}`
        ).join("\n");
        
        return {
          content: [
            {
              type: "text",
              text: `**Available Zilliqa APIs (${category}):**\n\n${apiList}`,
            },
          ],
        };
      }
      
      case "get_zilliqa_network_info": {
        const { network } = args as {
          network: "devnet" | "testnet" | "mainnet";
        };
        
        const networkInfo = {
          devnet: {
            name: "Devnet (Development Network)",
            chainId: "33103",
            rpcUrl: "https://api.zq2-devnet.zilliqa.com",
            explorer: "https://explorer.zq2-devnet.zilliqa.com",
            faucet: "https://faucet.zq2-devnet.zilliqa.com",
            purpose: "Development and testing environment with latest features",
            reset: "May be reset periodically",
            description: "Use for experimental features and early development"
          },
          testnet: {
            name: "Testnet (Test Network)",
            chainId: "33101",
            rpcUrl: "https://api.zq2-testnet.zilliqa.com",
            explorer: "https://explorer.zq2-testnet.zilliqa.com",
            faucet: "https://faucet.zq2-testnet.zilliqa.com",
            purpose: "Stable testing environment for application testing",
            reset: "Rarely reset, stable for testing",
            description: "Use for application testing and integration"
          },
          mainnet: {
            name: "Mainnet (Production Network)",
            chainId: "32769",
            rpcUrl: "https://api.zilliqa.com",
            explorer: "https://explorer.zilliqa.com",
            faucet: "N/A (Real ZIL required)",
            purpose: "Production environment with real value transactions",
            reset: "Never reset, production environment",
            description: "Use for production deployments only"
          }
        };
        
        const info = networkInfo[network];
        
        const response = `**${info.name}**\n\n` +
          `**Chain ID:** ${info.chainId}\n` +
          `**RPC URL:** ${info.rpcUrl}\n` +
          `**Explorer:** ${info.explorer}\n` +
          `**Faucet:** ${info.faucet}\n` +
          `**Purpose:** ${info.purpose}\n` +
          `**Reset Policy:** ${info.reset}\n` +
          `**Usage:** ${info.description}\n`;
        
        return {
          content: [
            {
              type: "text",
              text: response,
            },
          ],
        };
      }
      
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    throw new Error(`Tool execution failed: ${error instanceof Error ? error.message : String(error)}`);
  }
});

async function main() {
  const port = process.env.PORT || 3000;
  const useHttp = process.env.MCP_TRANSPORT === "http" || process.env.NODE_ENV === "production";
  
  if (useHttp) {
    const httpServer = http.createServer(async (req, res) => {
      if (req.method === "OPTIONS") {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
        res.writeHead(200);
        res.end();
        return;
      }

      if (req.method === "POST") {
        let body = "";
        req.on("data", (chunk) => {
          body += chunk.toString();
        });
        
        req.on("end", async () => {
          try {
            const request = JSON.parse(body);
            let response;
            
            if (request.method === "tools/list") {
              response = {
                tools: [
                  {
                    name: "search_zilliqa_docs",
                    description: "Search through Zilliqa documentation for specific topics or keywords",
                    inputSchema: {
                      type: "object",
                      properties: {
                        query: {
                          type: "string",
                          description: "Search query to find relevant documentation sections",
                        },
                        category: {
                          type: "string",
                          description: "Category to search in: 'blockchain', 'devdocs', or 'all'",
                          enum: ["blockchain", "devdocs", "all"],
                          default: "all",
                        },
                        language: {
                          type: "string",
                          description: "Filter by programming language (optional)",
                        },
                      },
                      required: ["query"],
                    },
                  },
                  {
                    name: "get_zilliqa_api_example",
                    description: "Get specific API examples from Zilliqa documentation",
                    inputSchema: {
                      type: "object",
                      properties: {
                        api_name: {
                          type: "string",
                          description: "Name of the API method to get examples for",
                        },
                        language: {
                          type: "string",
                          description: "Programming language for the example (java, python, go, curl, node.js)",
                        },
                      },
                      required: ["api_name"],
                    },
                  },
                  {
                    name: "list_zilliqa_apis",
                    description: "List all available API methods in the Zilliqa documentation",
                    inputSchema: {
                      type: "object",
                      properties: {
                        category: {
                          type: "string",
                          description: "Category to list: 'blockchain', 'devdocs', or 'all'",
                          enum: ["blockchain", "devdocs", "all"],
                          default: "all",
                        },
                      },
                    },
                  },
                ],
              };
            } else if (request.method === "tools/call") {
              const { name, arguments: args } = request.params;
              const docs = loadDocuments();
              
              switch (name) {
                case "search_zilliqa_docs": {
                  const { query, category = "all", language } = args as {
                    query: string;
                    category?: "blockchain" | "devdocs" | "all";
                    language?: string;
                  };
                  
                  let sections: DocumentSection[] = [];
                  
                  if (category === "all") {
                    sections = [...docs.blockchain, ...docs.devDocs];
                  } else if (category === "blockchain") {
                    sections = docs.blockchain;
                  } else if (category === "devdocs") {
                    sections = docs.devDocs;
                  }
                  
                  const results = sections.filter(section => {
                    const matchesQuery = section.title.toLowerCase().includes(query.toLowerCase()) ||
                                       section.description.toLowerCase().includes(query.toLowerCase()) ||
                                       section.content.toLowerCase().includes(query.toLowerCase());
                    
                    const matchesLanguage = !language || section.language?.toLowerCase() === language.toLowerCase();
                    
                    return matchesQuery && matchesLanguage;
                  });
                  
                  if (results.length === 0) {
                    response = {
                      content: [
                        {
                          type: "text",
                          text: `No documentation found for query: "${query}"${language ? ` in language: ${language}` : ""}`,
                        },
                      ],
                    };
                  } else {
                    const responseText = results.map(section => 
                      `**${section.title}**\n${section.description}\n\n${section.language ? `Language: ${section.language}\n` : ""}${section.code ? `\`\`\`${section.language}\n${section.code}\n\`\`\`` : ""}\n\nSource: ${section.source}\n`
                    ).join("\n---\n\n");
                    
                    response = {
                      content: [
                        {
                          type: "text",
                          text: responseText,
                        },
                      ],
                    };
                  }
                  break;
                }
                
                case "get_zilliqa_api_example": {
                  const { api_name, language } = args as {
                    api_name: string;
                    language?: string;
                  };
                  
                  const allSections = [...docs.blockchain, ...docs.devDocs];
                  const apiSections = allSections.filter(section =>
                    section.title.toLowerCase().includes(api_name.toLowerCase())
                  );
                  
                  if (apiSections.length === 0) {
                    response = {
                      content: [
                        {
                          type: "text",
                          text: `No API examples found for: "${api_name}"`,
                        },
                      ],
                    };
                  } else {
                    let filteredSections = apiSections;
                    if (language) {
                      filteredSections = apiSections.filter(section =>
                        section.language?.toLowerCase() === language.toLowerCase()
                      );
                      
                      if (filteredSections.length === 0) {
                        response = {
                          content: [
                            {
                              type: "text",
                              text: `No examples found for "${api_name}" in language: ${language}\n\nAvailable languages: ${Array.from(new Set(apiSections.map(s => s.language).filter(Boolean))).join(", ")}`,
                            },
                          ],
                        };
                        break;
                      }
                    }
                    
                    const responseText = filteredSections.map(section =>
                      `**${section.title}**\n${section.description}\n\n${section.language ? `Language: ${section.language}\n` : ""}${section.code ? `\`\`\`${section.language}\n${section.code}\n\`\`\`` : ""}\n\nSource: ${section.source}\n`
                    ).join("\n---\n\n");
                    
                    response = {
                      content: [
                        {
                          type: "text",
                          text: responseText,
                        },
                      ],
                    };
                  }
                  break;
                }
                
                case "list_zilliqa_apis": {
                  const { category = "all" } = args as {
                    category?: "blockchain" | "devdocs" | "all";
                  };
                  
                  let sections: DocumentSection[] = [];
                  
                  if (category === "all") {
                    sections = [...docs.blockchain, ...docs.devDocs];
                  } else if (category === "blockchain") {
                    sections = docs.blockchain;
                  } else if (category === "devdocs") {
                    sections = docs.devDocs;
                  }
                  
                  const apiList = sections.map(section => 
                    `• **${section.title}**${section.language ? ` (${section.language})` : ""}\n  ${section.description}`
                  ).join("\n");
                  
                  response = {
                    content: [
                      {
                        type: "text",
                        text: `**Available Zilliqa APIs (${category}):**\n\n${apiList}`,
                      },
                    ],
                  };
                  break;
                }
                
                default:
                  throw new Error(`Unknown tool: ${name}`);
              }
            } else {
              throw new Error(`Unknown method: ${request.method}`);
            }
            
            res.setHeader("Content-Type", "application/json");
            res.setHeader("Access-Control-Allow-Origin", "*");
            res.writeHead(200);
            res.end(JSON.stringify(response));
          } catch (error) {
            res.setHeader("Content-Type", "application/json");
            res.setHeader("Access-Control-Allow-Origin", "*");
            res.writeHead(400);
            res.end(JSON.stringify({ 
              error: error instanceof Error ? error.message : String(error) 
            }));
          }
        });
      } else if (req.method === "GET" && req.url === "/") {
        res.setHeader("Content-Type", "text/html");
        res.writeHead(200);
        res.end(`
          <!DOCTYPE html>
          <html>
            <head><title>Zilliqa MCP Server</title></head>
            <body>
              <h1>Zilliqa MCP Server</h1>
              <p>Server is running and ready to accept MCP requests.</p>
              <h2>Available Tools:</h2>
              <ul>
                <li><strong>search_zilliqa_docs</strong> - Search through Zilliqa documentation</li>
                <li><strong>get_zilliqa_api_example</strong> - Get specific API examples</li>
                <li><strong>list_zilliqa_apis</strong> - List all available APIs</li>
              </ul>
              <p>Send POST requests to this endpoint with MCP protocol messages.</p>
            </body>
          </html>
        `);
      } else {
        res.writeHead(404);
        res.end("Not Found");
      }
    });
    
    httpServer.listen(port, () => {
      console.log(`Zilliqa MCP Server running on HTTP port ${port}`);
    });
  } else {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Zilliqa MCP Server running on stdio");
  }
}

main().catch(console.error);