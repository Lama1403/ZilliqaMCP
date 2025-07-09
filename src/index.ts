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
import * as crypto from "crypto";
import * as https from "https";

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

// Zilliqa 2.0 Staking Portal Information
const STAKING_PORTAL_INFO = {
  overview: {
    url: "https://stake.zilliqa.com",
    description: "Official Zilliqa 2.0 staking portal for Proof-of-Stake delegation",
    features: [
      "Web-based interface for staking operations",
      "MetaMask wallet integration",
      "Support for both liquid and non-liquid staking",
      "Validator selection and monitoring",
      "Rewards claiming and unstaking"
    ],
    context: "Part of Zilliqa 2.0's migration from Proof-of-Work to Proof-of-Stake"
  },
  
  "liquid-staking": {
    description: "Receive Liquid Staking Tokens (LST) that can be traded while earning rewards",
    benefits: [
      "Tokens remain liquid and tradeable",
      "Continue earning staking rewards",
      "More flexibility for DeFi participation"
    ]
  },
  
  "non-liquid-staking": {
    description: "Traditional staking where you can withdraw rewards without unstaking principal",
    benefits: [
      "Direct delegation to validators",
      "Claim rewards without unstaking",
      "Simple staking mechanism"
    ]
  },
  
  "validator-selection": {
    description: "Choose from available validators in the network",
    considerations: [
      "Validator commission rates",
      "Performance history",
      "Uptime and reliability",
      "Community reputation"
    ]
  },
  
  requirements: {
    minimumStake: "100 ZIL",
    estimatedFees: "~12 ZIL for transaction fees",
    wallet: "MetaMask wallet required",
    network: "Zilliqa 2.0 mainnet"
  },
  
  "how-to-stake": {
    steps: [
      "Connect your MetaMask wallet to stake.zilliqa.com",
      "Choose between liquid or non-liquid staking",
      "Select a validator from the available list",
      "Enter staking amount (minimum 100 ZIL + fees)",
      "Confirm transaction and start earning rewards",
      "Monitor performance through the dashboard"
    ]
  },
  
  rewards: {
    claiming: "Withdraw earned rewards without unstaking principal",
    monitoring: "Track staking activity through the portal dashboard",
    frequency: "Rewards can be claimed at any time"
  }
};

// Bech32 implementation for Zilliqa address conversion
const BECH32_CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

function bech32Polymod(values: number[]): number {
  const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  let chk = 1;
  for (let value of values) {
    let top = chk >> 25;
    chk = (chk & 0x1ffffff) << 5 ^ value;
    for (let i = 0; i < 5; i++) {
      chk ^= ((top >> i) & 1) ? GEN[i] : 0;
    }
  }
  return chk;
}

function bech32HrpExpand(hrp: string): number[] {
  return hrp.split('').map(x => x.charCodeAt(0) >> 5)
    .concat([0])
    .concat(hrp.split('').map(x => x.charCodeAt(0) & 31));
}

function bech32VerifyChecksum(hrp: string, data: number[]): boolean {
  return bech32Polymod(bech32HrpExpand(hrp).concat(data)) === 1;
}

function bech32CreateChecksum(hrp: string, data: number[]): number[] {
  const values = bech32HrpExpand(hrp).concat(data).concat([0, 0, 0, 0, 0, 0]);
  const polymod = bech32Polymod(values) ^ 1;
  const result = [];
  for (let i = 0; i < 6; i++) {
    result.push((polymod >> 5 * (5 - i)) & 31);
  }
  return result;
}

function bech32Encode(hrp: string, data: number[]): string {
  const combined = data.concat(bech32CreateChecksum(hrp, data));
  return hrp + '1' + combined.map(d => BECH32_CHARSET[d]).join('');
}

function bech32Decode(bechString: string): { hrp: string; data: number[] } {
  if (bechString.length < 8 || bechString.length > 90) {
    throw new Error('Invalid bech32 string length');
  }
  
  if (bechString.toLowerCase() !== bechString && bechString.toUpperCase() !== bechString) {
    throw new Error('Mixed case in bech32 string');
  }
  
  bechString = bechString.toLowerCase();
  const pos = bechString.lastIndexOf('1');
  if (pos < 1 || pos + 7 > bechString.length || pos + 1 + 6 >= bechString.length) {
    throw new Error('Invalid separator position');
  }
  
  const hrp = bechString.substring(0, pos);
  const data = [];
  
  for (let i = pos + 1; i < bechString.length; i++) {
    const d = BECH32_CHARSET.indexOf(bechString[i]);
    if (d === -1) {
      throw new Error('Invalid character in bech32 string');
    }
    data.push(d);
  }
  
  if (!bech32VerifyChecksum(hrp, data)) {
    throw new Error('Invalid bech32 checksum');
  }
  
  return { hrp, data: data.slice(0, -6) };
}

function convertBits(data: number[], fromBits: number, toBits: number, pad: boolean = true): number[] {
  let acc = 0;
  let bits = 0;
  const result = [];
  const maxv = (1 << toBits) - 1;
  
  for (let value of data) {
    if (value < 0 || value >> fromBits) {
      throw new Error('Invalid data for base conversion');
    }
    acc = (acc << fromBits) | value;
    bits += fromBits;
    while (bits >= toBits) {
      bits -= toBits;
      result.push((acc >> bits) & maxv);
    }
  }
  
  if (pad) {
    if (bits > 0) {
      result.push((acc << (toBits - bits)) & maxv);
    }
  } else if (bits >= fromBits || ((acc << (toBits - bits)) & maxv)) {
    throw new Error('Invalid padding in base conversion');
  }
  
  return result;
}

function bech32ToHex(bech32Address: string): string {
  try {
    if (!bech32Address.startsWith('zil1')) {
      throw new Error('Invalid Zilliqa bech32 address - must start with zil1');
    }
    
    const decoded = bech32Decode(bech32Address);
    if (decoded.hrp !== 'zil') {
      throw new Error('Invalid HRP for Zilliqa address');
    }
    
    const converted = convertBits(decoded.data, 5, 8, false);
    const hex = Buffer.from(converted).toString('hex').toLowerCase();
    
    if (hex.length !== 40) {
      throw new Error('Invalid address length after conversion - must be 20 bytes (40 hex chars)');
    }
    
    return hex;
  } catch (error) {
    throw new Error(`Bech32 to hex conversion failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function hexToBech32(hexAddress: string): string {
  try {
    let hex = hexAddress.toLowerCase();
    if (hex.startsWith('0x')) {
      hex = hex.slice(2);
    }
    
    if (hex.length !== 40) {
      throw new Error('Invalid hex address length - must be 40 characters (20 bytes)');
    }
    
    if (!/^[0-9a-f]+$/.test(hex)) {
      throw new Error('Invalid hex characters in address');
    }
    
    const bytes = Buffer.from(hex, 'hex');
    const converted = convertBits(Array.from(bytes), 8, 5, true);
    
    return bech32Encode('zil', converted);
  } catch (error) {
    throw new Error(`Hex to bech32 conversion failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function validateZilliqaAddress(address: string): { valid: boolean; type: string | null; error: string | null } {
  if (typeof address !== 'string') {
    return { valid: false, type: null, error: 'Address must be a string' };
  }
  
  if (address.startsWith('zil1')) {
    try {
      bech32ToHex(address);
      return { valid: true, type: 'bech32', error: null };
    } catch (error) {
      return { valid: false, type: 'bech32', error: error instanceof Error ? error.message : String(error) };
    }
  } else if (address.startsWith('0x') || /^[0-9a-fA-F]{40}$/.test(address)) {
    try {
      hexToBech32(address);
      return { valid: true, type: 'hex', error: null };
    } catch (error) {
      return { valid: false, type: 'hex', error: error instanceof Error ? error.message : String(error) };
    }
  } else {
    return { valid: false, type: null, error: 'Address format not recognized - must be bech32 (zil1...) or hex (40 chars with/without 0x)' };
  }
}

// Helper function to fetch content from any URL
async function fetchWebContent(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const html = await response.text();
    
    // Extract main content from the HTML (improved extraction)
    const contentMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i) || 
                        html.match(/<article[^>]*>([\s\S]*?)<\/article>/i) ||
                        html.match(/<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
                        html.match(/<div[^>]*id="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
                        html.match(/<section[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/section>/i);
    
    if (contentMatch) {
      // Clean up HTML tags and return text content
      return contentMatch[1]
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
        .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
        .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }
    
    // Fallback: try to extract from body or just clean the whole HTML
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (bodyMatch) {
      return bodyMatch[1]
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
        .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
        .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 2000); // Limit to first 2000 chars for fallback
    }
    
    return `Content fetched from ${url} but could not extract main content.`;
  } catch (error) {
    return `Failed to fetch content from ${url}: ${error instanceof Error ? error.message : String(error)}`;
  }
}

// Helper function to detect and fetch content from any URLs in text
async function enrichWithWebContent(text: string): Promise<string> {
  // Match any HTTP/HTTPS URL
  const urlPattern = /https?:\/\/[^\s)]+/g;
  const urls = text.match(urlPattern);
  
  if (!urls || urls.length === 0) {
    return text;
  }
  
  let enrichedText = text;
  
  // Remove duplicates
  const uniqueUrls = [...new Set(urls)];
  
  for (const url of uniqueUrls) {
    try {
      const content = await fetchWebContent(url);
      enrichedText += `\n\n**Content from ${url}:**\n\n${content}`;
    } catch (error) {
      enrichedText += `\n\n**Note:** Could not fetch content from ${url}`;
    }
  }
  
  return enrichedText;
}

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

function loadDocuments(): { blockchain: DocumentSection[], devDocs: DocumentSection[], ethereumMetrics: DocumentSection[], delegatedStaking: DocumentSection[], zilliqaStaking: DocumentSection[] } {
  const blockchainPath = path.join(DOCS_PATH, "ZilliqaBlockcahin.txt");
  const devDocsPath = path.join(DOCS_PATH, "ZilliqaDevDocs.txt");
  const ethereumMetricsPath = path.join(DOCS_PATH, "Ethereum Metrics Exporter.txt");
  const delegatedStakingPath = path.join(DOCS_PATH, "delegated_staking.txt");
  const zilliqaStakingPath = path.join(DOCS_PATH, "Zilliqa Staking.txt");
  
  const blockchainContent = fs.readFileSync(blockchainPath, "utf-8");
  const devDocsContent = fs.readFileSync(devDocsPath, "utf-8");
  const ethereumMetricsContent = fs.readFileSync(ethereumMetricsPath, "utf-8");
  const delegatedStakingContent = fs.readFileSync(delegatedStakingPath, "utf-8");
  const zilliqaStakingContent = fs.readFileSync(zilliqaStakingPath, "utf-8");
  
  return {
    blockchain: parseDocumentSections(blockchainContent),
    devDocs: parseDocumentSections(devDocsContent),
    ethereumMetrics: parseDocumentSections(ethereumMetricsContent),
    delegatedStaking: parseDocumentSections(delegatedStakingContent),
    zilliqaStaking: parseDocumentSections(zilliqaStakingContent)
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
              description: "Category to search in: 'blockchain', 'devdocs', 'ethereumMetrics', 'delegatedStaking', 'zilliqaStaking', or 'all'",
              enum: ["blockchain", "devdocs", "ethereumMetrics", "delegatedStaking", "zilliqaStaking", "all"],
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
              description: "Category to list: 'blockchain', 'devdocs', 'ethereumMetrics', 'delegatedStaking', 'zilliqaStaking', or 'all'",
              enum: ["blockchain", "devdocs", "ethereumMetrics", "delegatedStaking", "zilliqaStaking", "all"],
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
      {
        name: "convert_zilliqa_address",
        description: "Convert Zilliqa addresses between bech32 (zil1...) and hex formats",
        inputSchema: {
          type: "object",
          properties: {
            address: {
              type: "string",
              description: "The Zilliqa address to convert (either bech32 or hex format)",
            },
          },
          required: ["address"],
        },
      },
      {
        name: "validate_zilliqa_address",
        description: "Validate a Zilliqa address format without conversion",
        inputSchema: {
          type: "object",
          properties: {
            address: {
              type: "string",
              description: "The Zilliqa address to validate",
            },
          },
          required: ["address"],
        },
      },
      {
        name: "batch_convert_zilliqa_addresses",
        description: "Convert multiple Zilliqa addresses in a single request (maximum 100 addresses)",
        inputSchema: {
          type: "object",
          properties: {
            addresses: {
              type: "array",
              description: "Array of Zilliqa addresses to convert",
              items: {
                type: "string",
              },
              maxItems: 100,
            },
          },
          required: ["addresses"],
        },
      },
      {
        name: "request_zilliqa_faucet",
        description: "Request test ZIL tokens from Zilliqa faucet (devnet: 100 ZIL, testnet: 100 ZIL)",
        inputSchema: {
          type: "object",
          properties: {
            network: {
              type: "string",
              description: "The network to request tokens from",
              enum: ["devnet", "testnet"],
            },
            address: {
              type: "string",
              description: "The Zilliqa address to send tokens to (bech32 or hex format)",
            },
          },
          required: ["network", "address"],
        },
      },
      {
        name: "get_network_stats",
        description: "Get live network statistics for Zilliqa networks (mainnet, testnet, devnet)",
        inputSchema: {
          type: "object",
          properties: {
            network: {
              type: "string",
              description: "The network to get statistics for",
              enum: ["mainnet", "testnet", "devnet"],
            },
          },
          required: ["network"],
        },
      },
      {
        name: "get_staking_portal_info",
        description: "Get information about the official Zilliqa 2.0 staking portal (stake.zilliqa.com)",
        inputSchema: {
          type: "object",
          properties: {
            topic: {
              type: "string",
              description: "Specific staking topic to get info about",
              enum: ["overview", "liquid-staking", "non-liquid-staking", "validator-selection", "rewards", "how-to-stake", "requirements"],
              default: "overview"
            },
          },
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
          category?: "blockchain" | "devdocs" | "ethereumMetrics" | "delegatedStaking" | "zilliqaStaking" | "all";
          language?: string;
        };
        
        let sections: DocumentSection[] = [];
        
        if (category === "all") {
          sections = [...docs.blockchain, ...docs.devDocs, ...docs.ethereumMetrics, ...docs.delegatedStaking, ...docs.zilliqaStaking];
        } else if (category === "blockchain") {
          sections = docs.blockchain;
        } else if (category === "devdocs") {
          sections = docs.devDocs;
        } else if (category === "ethereumMetrics") {
          sections = docs.ethereumMetrics;
        } else if (category === "delegatedStaking") {
          sections = docs.delegatedStaking;
        } else if (category === "zilliqaStaking") {
          sections = docs.zilliqaStaking;
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
        
        // Also add all source URLs to be fetched
        const allSourceUrls = results.map(section => section.source).filter(source => source.startsWith('http'));
        const sourceUrlsText = allSourceUrls.length > 0 ? `\n\nSource URLs: ${allSourceUrls.join(', ')}` : '';
        const responseWithSources = response + sourceUrlsText;
        
        const enrichedResponse = await enrichWithWebContent(responseWithSources);
        
        return {
          content: [
            {
              type: "text",
              text: enrichedResponse,
            },
          ],
        };
      }
      
      case "get_zilliqa_api_example": {
        const { api_name, language } = args as {
          api_name: string;
          language?: string;
        };
        
        const allSections = [...docs.blockchain, ...docs.devDocs, ...docs.ethereumMetrics, ...docs.delegatedStaking, ...docs.zilliqaStaking];
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
        
        const enrichedResponse = await enrichWithWebContent(response);
        
        return {
          content: [
            {
              type: "text",
              text: enrichedResponse,
            },
          ],
        };
      }
      
      case "list_zilliqa_apis": {
        const { category = "all" } = args as {
          category?: "blockchain" | "devdocs" | "ethereumMetrics" | "delegatedStaking" | "zilliqaStaking" | "all";
        };
        
        let sections: DocumentSection[] = [];
        
        if (category === "all") {
          sections = [...docs.blockchain, ...docs.devDocs, ...docs.ethereumMetrics, ...docs.delegatedStaking, ...docs.zilliqaStaking];
        } else if (category === "blockchain") {
          sections = docs.blockchain;
        } else if (category === "devdocs") {
          sections = docs.devDocs;
        } else if (category === "ethereumMetrics") {
          sections = docs.ethereumMetrics;
        } else if (category === "delegatedStaking") {
          sections = docs.delegatedStaking;
        } else if (category === "zilliqaStaking") {
          sections = docs.zilliqaStaking;
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
          `**Usage:** ${info.description}\n` +
          `**Documentation:** https://dev.zilliqa.com/zilliqa2/endpoints/\n`;
        
        const enrichedResponse = await enrichWithWebContent(response);
        
        return {
          content: [
            {
              type: "text",
              text: enrichedResponse,
            },
          ],
        };
      }
      
      case "convert_zilliqa_address": {
        const { address } = args as {
          address: string;
        };
        
        const validation = validateZilliqaAddress(address);
        
        if (!validation.valid) {
          return {
            content: [
              {
                type: "text",
                text: `Invalid address: ${validation.error}`,
              },
            ],
          };
        }
        
        let bech32, hexWithoutPrefix, hexWithPrefix;
        
        if (validation.type === 'bech32') {
          bech32 = address;
          hexWithoutPrefix = bech32ToHex(address);
          hexWithPrefix = '0x' + hexWithoutPrefix;
        } else {
          hexWithoutPrefix = address.startsWith('0x') ? address.slice(2) : address;
          hexWithPrefix = '0x' + hexWithoutPrefix;
          bech32 = hexToBech32(address);
        }
        
        const response = `**Address Conversion Result**\n\n` +
          `**Input:**\n` +
          `- Address: \`${address}\`\n` +
          `- Type: ${validation.type}\n\n` +
          `**Output:**\n` +
          `- Bech32: \`${bech32}\`\n` +
          `- Hex (Zilliqa format): \`${hexWithoutPrefix}\`\n` +
          `- Hex (with prefix): \`${hexWithPrefix}\`\n\n` +
          `**Note:** Use hex_zilliqa_format for Zilliqa API calls (without 0x prefix)`;
        
        return {
          content: [
            {
              type: "text",
              text: response,
            },
          ],
        };
      }
      
      case "validate_zilliqa_address": {
        const { address } = args as {
          address: string;
        };
        
        const validation = validateZilliqaAddress(address);
        
        const response = `**Address Validation Result**\n\n` +
          `**Address:** \`${address}\`\n` +
          `**Valid:** ${validation.valid ? 'Yes' : 'No'}\n` +
          `**Type:** ${validation.type || 'Unknown'}\n` +
          `**Error:** ${validation.error || 'None'}`;
        
        return {
          content: [
            {
              type: "text",
              text: response,
            },
          ],
        };
      }
      
      case "batch_convert_zilliqa_addresses": {
        const { addresses } = args as {
          addresses: string[];
        };
        
        if (!Array.isArray(addresses)) {
          return {
            content: [
              {
                type: "text",
                text: "Error: addresses must be an array",
              },
            ],
          };
        }
        
        if (addresses.length > 100) {
          return {
            content: [
              {
                type: "text",
                text: "Error: Maximum 100 addresses per batch request",
              },
            ],
          };
        }
        
        const results = addresses.map((address, index) => {
          try {
            const validation = validateZilliqaAddress(address);
            
            if (!validation.valid) {
              return {
                index: index,
                input: address,
                success: false,
                error: validation.error
              };
            }
            
            let bech32, hexWithoutPrefix, hexWithPrefix;
            
            if (validation.type === 'bech32') {
              bech32 = address;
              hexWithoutPrefix = bech32ToHex(address);
              hexWithPrefix = '0x' + hexWithoutPrefix;
            } else {
              hexWithoutPrefix = address.startsWith('0x') ? address.slice(2) : address;
              hexWithPrefix = '0x' + hexWithoutPrefix;
              bech32 = hexToBech32(address);
            }
            
            return {
              index: index,
              input: address,
              success: true,
              bech32: bech32,
              hex_zilliqa_format: hexWithoutPrefix,
              hex_with_prefix: hexWithPrefix
            };
            
          } catch (error) {
            return {
              index: index,
              input: address,
              success: false,
              error: error instanceof Error ? error.message : String(error)
            };
          }
        });
        
        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;
        
        let response = `**Batch Address Conversion Results**\n\n` +
          `**Summary:**\n` +
          `- Total: ${addresses.length}\n` +
          `- Successful: ${successful}\n` +
          `- Failed: ${failed}\n\n` +
          `**Results:**\n`;
        
        results.forEach(result => {
          if (result.success) {
            response += `\n${result.index + 1}. ✅ \`${result.input}\`\n` +
              `   - Bech32: \`${result.bech32}\`\n` +
              `   - Hex (Zilliqa): \`${result.hex_zilliqa_format}\`\n` +
              `   - Hex (with prefix): \`${result.hex_with_prefix}\`\n`;
          } else {
            response += `\n${result.index + 1}. ❌ \`${result.input}\`\n` +
              `   - Error: ${result.error}\n`;
          }
        });
        
        return {
          content: [
            {
              type: "text",
              text: response,
            },
          ],
        };
      }
      
      case "request_zilliqa_faucet": {
        const { network, address } = args as {
          network: "devnet" | "testnet";
          address: string;
        };
        
        // Validate the address first
        const validation = validateZilliqaAddress(address);
        if (!validation.valid) {
          return {
            content: [
              {
                type: "text",
                text: `**Faucet Request Failed**\n\n❌ Invalid address: ${validation.error}`,
              },
            ],
          };
        }
        
        // Get the faucet URL
        const faucetUrls = {
          devnet: "https://faucet.zq2-devnet.zilliqa.com",
          testnet: "https://faucet.zq2-testnet.zilliqa.com"
        };
        
        const faucetUrl = faucetUrls[network];
        
        try {
          // Make request to faucet
          const response = await fetch(faucetUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `address=${encodeURIComponent(address)}`,
          });
          
          const responseText = await response.text();
          
          if (response.ok) {
            // Check if the response indicates success
            if (responseText.includes('notification is-success') || responseText.includes('Request sent') || responseText.includes('Transaction ID')) {
              // Extract transaction ID if available
              const txMatch = responseText.match(/Transaction ID:.*?href="[^"]*\/tx\/([^"]+)"/);
              const txId = txMatch ? txMatch[1] : null;
              
              return {
                content: [
                  {
                    type: "text",
                    text: `**Faucet Request Successful** ✅\n\n` +
                      `**Network:** ${network}\n` +
                      `**Address:** \`${address}\`\n` +
                      `**Amount:** 100 ZIL\n` +
                      `**Status:** Request submitted successfully\n` +
                      `${txId ? `**Transaction ID:** \`${txId}\`\n` : ''}` +
                      `**Explorer:** https://explorer.zq2-${network}.zilliqa.com${txId ? `/tx/${txId}` : ''}\n\n` +
                      `**Note:** It may take a few moments for the tokens to appear in your account.`,
                  },
                ],
              };
            }
            // Check if the response indicates an error (rate limiting, etc.)
            else if (responseText.includes('notification is-danger') || responseText.includes('Request made too recently') || responseText.includes('error')) {
              // Extract error message if available
              const errorMatch = responseText.match(/notification is-danger[^>]*>.*?<button[^>]*>[^<]*<\/button>\s*([^<]+)/);
              const errorMessage = errorMatch ? errorMatch[1].trim() : 'Faucet request was not successful';
              
              return {
                content: [
                  {
                    type: "text",
                    text: `**Faucet Request Failed** ❌\n\n` +
                      `**Network:** ${network}\n` +
                      `**Address:** \`${address}\`\n` +
                      `**Error:** ${errorMessage}\n\n` +
                      `**Suggestion:** ${errorMessage.includes('too recently') ? 'Please wait and try again later.' : 'Try again later or contact Zilliqa support if the issue persists.'}`,
                  },
                ],
              };
            } else {
              return {
                content: [
                  {
                    type: "text",
                    text: `**Faucet Request Status Unknown** ⚠️\n\n` +
                      `**Network:** ${network}\n` +
                      `**Address:** \`${address}\`\n` +
                      `**Status:** Request submitted but status unclear\n\n` +
                      `**Note:** Please check your balance on the ${network} explorer to verify if tokens were received.`,
                  },
                ],
              };
            }
          } else {
            return {
              content: [
                {
                  type: "text",
                  text: `**Faucet Request Failed** ❌\n\n` +
                    `**Network:** ${network}\n` +
                    `**Address:** \`${address}\`\n` +
                    `**Error:** HTTP ${response.status} - ${response.statusText}\n\n` +
                    `**Details:** The faucet service returned an error. This could be due to rate limiting or temporary service issues.`,
                },
              ],
            };
          }
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `**Faucet Request Failed** ❌\n\n` +
                  `**Network:** ${network}\n` +
                  `**Address:** \`${address}\`\n` +
                  `**Error:** ${error instanceof Error ? error.message : String(error)}\n\n` +
                  `**Suggestion:** Check your internet connection and try again.`,
              },
            ],
          };
        }
      }
      
      case "get_network_stats": {
        const { network } = args as {
          network: "mainnet" | "testnet" | "devnet";
        };
        
        try {
          // Get network RPC URLs
          const networkConfig = {
            mainnet: { 
              rpcUrl: "https://api.zilliqa.com", 
              explorer: "https://explorer.zilliqa.com",
              chainId: 32769,
              name: "Mainnet"
            },
            testnet: { 
              rpcUrl: "https://api.zq2-testnet.zilliqa.com", 
              explorer: "https://explorer.zq2-testnet.zilliqa.com",
              chainId: 33101,
              name: "Testnet"
            },
            devnet: { 
              rpcUrl: "https://api.zq2-devnet.zilliqa.com", 
              explorer: "https://explorer.zq2-devnet.zilliqa.com",
              chainId: 33103,
              name: "Devnet"
            }
          };
          
          const config = networkConfig[network];
          let statsResponse = `**${config.name} Network Statistics**\n\n`;
          
          // Get latest block info
          const blockResponse = await fetch(config.rpcUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              id: "1",
              jsonrpc: "2.0",
              method: "GetLatestTxBlock",
              params: []
            })
          });
          
          if (blockResponse.ok) {
            const blockResult = await blockResponse.json() as { result?: any; error?: any };
            
            if (blockResult.result && !blockResult.error) {
              const block = blockResult.result;
              let timestampStr = 'N/A';
              
              if (block.header?.Timestamp) {
                try {
                  // Parse timestamp - Zilliqa uses microseconds since epoch
                  let timestamp;
                  if (typeof block.header.Timestamp === 'string') {
                    const numericTimestamp = parseInt(block.header.Timestamp);
                    if (!isNaN(numericTimestamp)) {
                      // Convert microseconds to milliseconds for JavaScript Date
                      timestamp = new Date(numericTimestamp / 1000);
                    } else {
                      timestamp = new Date(block.header.Timestamp);
                    }
                  } else if (typeof block.header.Timestamp === 'number') {
                    // Convert microseconds to milliseconds for JavaScript Date
                    timestamp = new Date(block.header.Timestamp / 1000);
                  }
                  
                  if (timestamp && !isNaN(timestamp.getTime())) {
                    timestampStr = timestamp.toISOString();
                  } else {
                    timestampStr = `Raw: ${block.header.Timestamp}`;
                  }
                } catch (e) {
                  timestampStr = `Error: ${e instanceof Error ? e.message : String(e)}`;
                }
              }
              
              statsResponse += `**Latest Block:**\n`;
              statsResponse += `- Block Number: ${block.header?.BlockNum || 'N/A'}\n`;
              statsResponse += `- Timestamp: ${timestampStr}\n`;
              statsResponse += `- Gas Limit: ${block.header?.GasLimit || 'N/A'}\n`;
              statsResponse += `- Gas Used: ${block.header?.GasUsed || 'N/A'}\n`;
              statsResponse += `- Transaction Count: ${block.body?.BlockHash?.length || 0}\n\n`;
            }
          }
          
          // Get network ID
          const networkResponse = await fetch(config.rpcUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              id: "1",
              jsonrpc: "2.0",
              method: "GetNetworkId",
              params: []
            })
          });
          
          if (networkResponse.ok) {
            const networkResult = await networkResponse.json() as { result?: any; error?: any };
            
            if (networkResult.result && !networkResult.error) {
              statsResponse += `**Network Info:**\n`;
              statsResponse += `- Network ID: ${networkResult.result}\n`;
              statsResponse += `- Chain ID: ${config.chainId}\n`;
              statsResponse += `- Status: 🟢 Online\n\n`;
            }
          }
          
          statsResponse += `**Configuration:**\n`;
          statsResponse += `- RPC URL: ${config.rpcUrl}\n`;
          statsResponse += `- Explorer: ${config.explorer}\n`;
          
          return {
            content: [
              {
                type: "text",
                text: statsResponse,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `**Network Stats Error**\n\n` +
                  `Failed to fetch ${network} network statistics: ${error instanceof Error ? error.message : String(error)}\n\n` +
                  `Please check your internet connection and try again.`,
              },
            ],
          };
        }
      }
      
      case "get_staking_portal_info": {
        const { topic = "overview" } = args as {
          topic?: keyof typeof STAKING_PORTAL_INFO;
        };
        
        try {
          if (!STAKING_PORTAL_INFO[topic]) {
            return {
              content: [
                {
                  type: "text",
                  text: `**Staking Portal Info Error**\n\n` +
                    `Topic '${topic}' not found.\n\n` +
                    `**Available topics:** ${Object.keys(STAKING_PORTAL_INFO).join(", ")}\n\n` +
                    `**Portal URL:** https://stake.zilliqa.com`,
                },
              ],
            };
          }
          
          const info = STAKING_PORTAL_INFO[topic] as any;
          let response = `**Zilliqa 2.0 Staking Portal - ${topic.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}**\n\n`;
          
          if (topic === "overview") {
            response += `**Portal URL:** ${info.url}\n\n`;
            response += `**Description:** ${info.description}\n\n`;
            response += `**Features:**\n${info.features.map((f: string) => `- ${f}`).join('\n')}\n\n`;
            response += `**Context:** ${info.context}\n\n`;
          } else if (topic === "liquid-staking" || topic === "non-liquid-staking") {
            response += `**Description:** ${info.description}\n\n`;
            response += `**Benefits:**\n${info.benefits.map((b: string) => `- ${b}`).join('\n')}\n\n`;
          } else if (topic === "validator-selection") {
            response += `**Description:** ${info.description}\n\n`;
            response += `**Considerations:**\n${info.considerations.map((c: string) => `- ${c}`).join('\n')}\n\n`;
          } else if (topic === "requirements") {
            response += `**Staking Requirements:**\n`;
            response += `- **Minimum Stake:** ${info.minimumStake}\n`;
            response += `- **Estimated Fees:** ${info.estimatedFees}\n`;
            response += `- **Wallet:** ${info.wallet}\n`;
            response += `- **Network:** ${info.network}\n\n`;
          } else if (topic === "how-to-stake") {
            response += `**How to Stake:**\n`;
            response += `${info.steps.map((step: string, i: number) => `${i + 1}. ${step}`).join('\n')}\n\n`;
          } else if (topic === "rewards") {
            response += `**Rewards Information:**\n`;
            response += `- **Claiming:** ${info.claiming}\n`;
            response += `- **Monitoring:** ${info.monitoring}\n`;
            response += `- **Frequency:** ${info.frequency}\n\n`;
          }
          
          // Add common footer
          response += `**Portal URL:** https://stake.zilliqa.com\n`;
          response += `**Available Topics:** ${Object.keys(STAKING_PORTAL_INFO).join(", ")}\n`;
          response += `**Last Updated:** ${new Date().toISOString()}`;
          
          return {
            content: [
              {
                type: "text",
                text: response,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `**Staking Portal Info Error**\n\n` +
                  `Failed to get staking portal information: ${error instanceof Error ? error.message : String(error)}\n\n` +
                  `**Portal URL:** https://stake.zilliqa.com`,
              },
            ],
          };
        }
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
  const useHttp = process.env.MCP_TRANSPORT !== "stdio";
  
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
                          description: "Category to search in: 'blockchain', 'devdocs', 'ethereumMetrics', 'delegatedStaking', 'zilliqaStaking', or 'all'",
                          enum: ["blockchain", "devdocs", "ethereumMetrics", "delegatedStaking", "zilliqaStaking", "all"],
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
                          description: "Category to list: 'blockchain', 'devdocs', 'ethereumMetrics', 'delegatedStaking', 'zilliqaStaking', or 'all'",
                          enum: ["blockchain", "devdocs", "ethereumMetrics", "delegatedStaking", "zilliqaStaking", "all"],
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
                  {
                    name: "convert_zilliqa_address",
                    description: "Convert Zilliqa addresses between bech32 (zil1...) and hex formats",
                    inputSchema: {
                      type: "object",
                      properties: {
                        address: {
                          type: "string",
                          description: "The Zilliqa address to convert (either bech32 or hex format)",
                        },
                      },
                      required: ["address"],
                    },
                  },
                  {
                    name: "validate_zilliqa_address",
                    description: "Validate a Zilliqa address format without conversion",
                    inputSchema: {
                      type: "object",
                      properties: {
                        address: {
                          type: "string",
                          description: "The Zilliqa address to validate",
                        },
                      },
                      required: ["address"],
                    },
                  },
                  {
                    name: "batch_convert_zilliqa_addresses",
                    description: "Convert multiple Zilliqa addresses in a single request (maximum 100 addresses)",
                    inputSchema: {
                      type: "object",
                      properties: {
                        addresses: {
                          type: "array",
                          description: "Array of Zilliqa addresses to convert",
                          items: {
                            type: "string",
                          },
                          maxItems: 100,
                        },
                      },
                      required: ["addresses"],
                    },
                  },
                  {
                    name: "request_zilliqa_faucet",
                    description: "Request test ZIL tokens from Zilliqa faucet (devnet: 100 ZIL, testnet: 100 ZIL)",
                    inputSchema: {
                      type: "object",
                      properties: {
                        network: {
                          type: "string",
                          description: "The network to request tokens from",
                          enum: ["devnet", "testnet"],
                        },
                        address: {
                          type: "string",
                          description: "The Zilliqa address to send tokens to (bech32 or hex format)",
                        },
                      },
                      required: ["network", "address"],
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
                    category?: "blockchain" | "devdocs" | "ethereumMetrics" | "delegatedStaking" | "zilliqaStaking" | "all";
                    language?: string;
                  };
                  
                  let sections: DocumentSection[] = [];
                  
                  if (category === "all") {
                    sections = [...docs.blockchain, ...docs.devDocs, ...docs.ethereumMetrics, ...docs.delegatedStaking, ...docs.zilliqaStaking];
                  } else if (category === "blockchain") {
                    sections = docs.blockchain;
                  } else if (category === "devdocs") {
                    sections = docs.devDocs;
                  } else if (category === "ethereumMetrics") {
                    sections = docs.ethereumMetrics;
                  } else if (category === "delegatedStaking") {
                    sections = docs.delegatedStaking;
                  } else if (category === "zilliqaStaking") {
                    sections = docs.zilliqaStaking;
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
                    
                    const enrichedResponseText = await enrichWithWebContent(responseText);
                    
                    response = {
                      content: [
                        {
                          type: "text",
                          text: enrichedResponseText,
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
                  
                  const allSections = [...docs.blockchain, ...docs.devDocs, ...docs.ethereumMetrics, ...docs.delegatedStaking, ...docs.zilliqaStaking];
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
                    
                    const enrichedResponseText = await enrichWithWebContent(responseText);
                    
                    response = {
                      content: [
                        {
                          type: "text",
                          text: enrichedResponseText,
                        },
                      ],
                    };
                  }
                  break;
                }
                
                case "list_zilliqa_apis": {
                  const { category = "all" } = args as {
                    category?: "blockchain" | "devdocs" | "ethereumMetrics" | "delegatedStaking" | "zilliqaStaking" | "all";
                  };
                  
                  let sections: DocumentSection[] = [];
                  
                  if (category === "all") {
                    sections = [...docs.blockchain, ...docs.devDocs, ...docs.ethereumMetrics, ...docs.delegatedStaking, ...docs.zilliqaStaking];
                  } else if (category === "blockchain") {
                    sections = docs.blockchain;
                  } else if (category === "devdocs") {
                    sections = docs.devDocs;
                  } else if (category === "ethereumMetrics") {
                    sections = docs.ethereumMetrics;
                  } else if (category === "delegatedStaking") {
                    sections = docs.delegatedStaking;
                  } else if (category === "zilliqaStaking") {
                    sections = docs.zilliqaStaking;
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
                  
                  const responseText = `**${info.name}**\n\n` +
                    `**Chain ID:** ${info.chainId}\n` +
                    `**RPC URL:** ${info.rpcUrl}\n` +
                    `**Explorer:** ${info.explorer}\n` +
                    `**Faucet:** ${info.faucet}\n` +
                    `**Purpose:** ${info.purpose}\n` +
                    `**Reset Policy:** ${info.reset}\n` +
                    `**Usage:** ${info.description}\n` +
                    `**Documentation:** https://dev.zilliqa.com/zilliqa2/endpoints/\n`;
                  
                  const enrichedResponseText = await enrichWithWebContent(responseText);
                  
                  response = {
                    content: [
                      {
                        type: "text",
                        text: enrichedResponseText,
                      },
                    ],
                  };
                  break;
                }
                
                case "convert_zilliqa_address": {
                  const { address } = args as {
                    address: string;
                  };
                  
                  const validation = validateZilliqaAddress(address);
                  
                  if (!validation.valid) {
                    response = {
                      content: [
                        {
                          type: "text",
                          text: `Invalid address: ${validation.error}`,
                        },
                      ],
                    };
                  } else {
                    let bech32, hexWithoutPrefix, hexWithPrefix;
                    
                    if (validation.type === 'bech32') {
                      bech32 = address;
                      hexWithoutPrefix = bech32ToHex(address);
                      hexWithPrefix = '0x' + hexWithoutPrefix;
                    } else {
                      hexWithoutPrefix = address.startsWith('0x') ? address.slice(2) : address;
                      hexWithPrefix = '0x' + hexWithoutPrefix;
                      bech32 = hexToBech32(address);
                    }
                    
                    const responseText = `**Address Conversion Result**\n\n` +
                      `**Input:**\n` +
                      `- Address: \`${address}\`\n` +
                      `- Type: ${validation.type}\n\n` +
                      `**Output:**\n` +
                      `- Bech32: \`${bech32}\`\n` +
                      `- Hex (Zilliqa format): \`${hexWithoutPrefix}\`\n` +
                      `- Hex (with prefix): \`${hexWithPrefix}\`\n\n` +
                      `**Note:** Use hex_zilliqa_format for Zilliqa API calls (without 0x prefix)`;
                    
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
                
                case "validate_zilliqa_address": {
                  const { address } = args as {
                    address: string;
                  };
                  
                  const validation = validateZilliqaAddress(address);
                  
                  const responseText = `**Address Validation Result**\n\n` +
                    `**Address:** \`${address}\`\n` +
                    `**Valid:** ${validation.valid ? 'Yes' : 'No'}\n` +
                    `**Type:** ${validation.type || 'Unknown'}\n` +
                    `**Error:** ${validation.error || 'None'}`;
                  
                  response = {
                    content: [
                      {
                        type: "text",
                        text: responseText,
                      },
                    ],
                  };
                  break;
                }
                
                case "batch_convert_zilliqa_addresses": {
                  const { addresses } = args as {
                    addresses: string[];
                  };
                  
                  if (!Array.isArray(addresses)) {
                    response = {
                      content: [
                        {
                          type: "text",
                          text: "Error: addresses must be an array",
                        },
                      ],
                    };
                  } else if (addresses.length > 100) {
                    response = {
                      content: [
                        {
                          type: "text",
                          text: "Error: Maximum 100 addresses per batch request",
                        },
                      ],
                    };
                  } else {
                    const results = addresses.map((address, index) => {
                      try {
                        const validation = validateZilliqaAddress(address);
                        
                        if (!validation.valid) {
                          return {
                            index: index,
                            input: address,
                            success: false,
                            error: validation.error
                          };
                        }
                        
                        let bech32, hexWithoutPrefix, hexWithPrefix;
                        
                        if (validation.type === 'bech32') {
                          bech32 = address;
                          hexWithoutPrefix = bech32ToHex(address);
                          hexWithPrefix = '0x' + hexWithoutPrefix;
                        } else {
                          hexWithoutPrefix = address.startsWith('0x') ? address.slice(2) : address;
                          hexWithPrefix = '0x' + hexWithoutPrefix;
                          bech32 = hexToBech32(address);
                        }
                        
                        return {
                          index: index,
                          input: address,
                          success: true,
                          bech32: bech32,
                          hex_zilliqa_format: hexWithoutPrefix,
                          hex_with_prefix: hexWithPrefix
                        };
                        
                      } catch (error) {
                        return {
                          index: index,
                          input: address,
                          success: false,
                          error: error instanceof Error ? error.message : String(error)
                        };
                      }
                    });
                    
                    const successful = results.filter(r => r.success).length;
                    const failed = results.filter(r => !r.success).length;
                    
                    let responseText = `**Batch Address Conversion Results**\n\n` +
                      `**Summary:**\n` +
                      `- Total: ${addresses.length}\n` +
                      `- Successful: ${successful}\n` +
                      `- Failed: ${failed}\n\n` +
                      `**Results:**\n`;
                    
                    results.forEach(result => {
                      if (result.success) {
                        responseText += `\n${result.index + 1}. ✅ \`${result.input}\`\n` +
                          `   - Bech32: \`${result.bech32}\`\n` +
                          `   - Hex (Zilliqa): \`${result.hex_zilliqa_format}\`\n` +
                          `   - Hex (with prefix): \`${result.hex_with_prefix}\`\n`;
                      } else {
                        responseText += `\n${result.index + 1}. ❌ \`${result.input}\`\n` +
                          `   - Error: ${result.error}\n`;
                      }
                    });
                    
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
                
                case "request_zilliqa_faucet": {
                  const { network, address } = args as {
                    network: "devnet" | "testnet";
                    address: string;
                  };
                  
                  // Validate the address first
                  const validation = validateZilliqaAddress(address);
                  if (!validation.valid) {
                    response = {
                      content: [
                        {
                          type: "text",
                          text: `**Faucet Request Failed**\n\n❌ Invalid address: ${validation.error}`,
                        },
                      ],
                    };
                  } else {
                    // Get the faucet URL
                    const faucetUrls = {
                      devnet: "https://faucet.zq2-devnet.zilliqa.com",
                      testnet: "https://faucet.zq2-testnet.zilliqa.com"
                    };
                    
                    const faucetUrl = faucetUrls[network];
                    
                    try {
                      // Make request to faucet
                      const faucetResponse = await fetch(faucetUrl, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/x-www-form-urlencoded',
                        },
                        body: `address=${encodeURIComponent(address)}`,
                      });
                      
                      const responseText = await faucetResponse.text();
                      
                      if (faucetResponse.ok) {
                        // Check if the response indicates success
                        if (responseText.includes('notification is-success') || responseText.includes('Request sent') || responseText.includes('Transaction ID')) {
                          // Extract transaction ID if available
                          const txMatch = responseText.match(/Transaction ID:.*?href="[^"]*\/tx\/([^"]+)"/);
                          const txId = txMatch ? txMatch[1] : null;
                          
                          response = {
                            content: [
                              {
                                type: "text",
                                text: `**Faucet Request Successful** ✅\n\n` +
                                  `**Network:** ${network}\n` +
                                  `**Address:** \`${address}\`\n` +
                                  `**Amount:** 100 ZIL\n` +
                                  `**Status:** Request submitted successfully\n` +
                                  `${txId ? `**Transaction ID:** \`${txId}\`\n` : ''}` +
                                  `**Explorer:** https://explorer.zq2-${network}.zilliqa.com${txId ? `/tx/${txId}` : ''}\n\n` +
                                  `**Note:** It may take a few moments for the tokens to appear in your account.`,
                              },
                            ],
                          };
                        }
                        // Check if the response indicates an error (rate limiting, etc.)
                        else if (responseText.includes('notification is-danger') || responseText.includes('Request made too recently') || responseText.includes('error')) {
                          // Extract error message if available
                          const errorMatch = responseText.match(/notification is-danger[^>]*>.*?<button[^>]*>[^<]*<\/button>\s*([^<]+)/);
                          const errorMessage = errorMatch ? errorMatch[1].trim() : 'Faucet request was not successful';
                          
                          response = {
                            content: [
                              {
                                type: "text",
                                text: `**Faucet Request Failed** ❌\n\n` +
                                  `**Network:** ${network}\n` +
                                  `**Address:** \`${address}\`\n` +
                                  `**Error:** ${errorMessage}\n\n` +
                                  `**Suggestion:** ${errorMessage.includes('too recently') ? 'Please wait and try again later.' : 'Try again later or contact Zilliqa support if the issue persists.'}`,
                              },
                            ],
                          };
                        } else {
                          response = {
                            content: [
                              {
                                type: "text",
                                text: `**Faucet Request Status Unknown** ⚠️\n\n` +
                                  `**Network:** ${network}\n` +
                                  `**Address:** \`${address}\`\n` +
                                  `**Status:** Request submitted but status unclear\n\n` +
                                  `**Note:** Please check your balance on the ${network} explorer to verify if tokens were received.`,
                              },
                            ],
                          };
                        }
                      } else {
                        response = {
                          content: [
                            {
                              type: "text",
                              text: `**Faucet Request Failed** ❌\n\n` +
                                `**Network:** ${network}\n` +
                                `**Address:** \`${address}\`\n` +
                                `**Error:** HTTP ${faucetResponse.status} - ${faucetResponse.statusText}\n\n` +
                                `**Details:** The faucet service returned an error. This could be due to rate limiting or temporary service issues.`,
                            },
                          ],
                        };
                      }
                    } catch (error) {
                      response = {
                        content: [
                          {
                            type: "text",
                            text: `**Faucet Request Failed** ❌\n\n` +
                              `**Network:** ${network}\n` +
                              `**Address:** \`${address}\`\n` +
                              `**Error:** ${error instanceof Error ? error.message : String(error)}\n\n` +
                              `**Suggestion:** Check your internet connection and try again.`,
                          },
                        ],
                      };
                    }
                  }
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
                <li><strong>get_zilliqa_network_info</strong> - Get network configuration and URLs</li>
                <li><strong>convert_zilliqa_address</strong> - Convert between bech32 and hex address formats</li>
                <li><strong>validate_zilliqa_address</strong> - Validate Zilliqa address format</li>
                <li><strong>batch_convert_zilliqa_addresses</strong> - Convert multiple addresses at once</li>
                <li><strong>request_zilliqa_faucet</strong> - Request test ZIL tokens from devnet/testnet faucets</li>
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