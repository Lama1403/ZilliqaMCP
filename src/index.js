#!/usr/bin/env node
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
var index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
var stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
var types_js_1 = require("@modelcontextprotocol/sdk/types.js");
var fs = require("fs");
var path = require("path");
var server = new index_js_1.Server({
    name: "zilliqa-mcp-server",
    version: "1.0.0",
}, {
    capabilities: {
        tools: {},
    },
});
var DOCS_PATH = path.join(__dirname, "../src/LLMtext");
function parseDocumentSections(content) {
    var sections = [];
    var sectionDelimiter = "----------------------------------------";
    var parts = content.split(sectionDelimiter);
    for (var _i = 0, parts_1 = parts; _i < parts_1.length; _i++) {
        var part = parts_1[_i];
        var trimmed = part.trim();
        if (!trimmed)
            continue;
        var lines = trimmed.split("\n");
        var title = "";
        var description = "";
        var source = "";
        var language = "";
        var code = "";
        var inCodeBlock = false;
        var codeLines = [];
        for (var _a = 0, lines_1 = lines; _a < lines_1.length; _a++) {
            var line = lines_1[_a];
            if (line.startsWith("TITLE: ")) {
                title = line.substring(7);
            }
            else if (line.startsWith("DESCRIPTION: ")) {
                description = line.substring(13);
            }
            else if (line.startsWith("SOURCE: ")) {
                source = line.substring(8);
            }
            else if (line.startsWith("LANGUAGE: ")) {
                language = line.substring(10);
            }
            else if (line === "```" && !inCodeBlock) {
                inCodeBlock = true;
            }
            else if (line === "```" && inCodeBlock) {
                inCodeBlock = false;
                code = codeLines.join("\n");
            }
            else if (inCodeBlock) {
                codeLines.push(line);
            }
        }
        if (title) {
            sections.push({
                title: title,
                description: description,
                source: source,
                language: language,
                code: code,
                content: trimmed
            });
        }
    }
    return sections;
}
function loadDocuments() {
    var blockchainPath = path.join(DOCS_PATH, "ZilliqaBlockcahin.txt");
    var devDocsPath = path.join(DOCS_PATH, "ZilliqaDevDocs.txt");
    var blockchainContent = fs.readFileSync(blockchainPath, "utf-8");
    var devDocsContent = fs.readFileSync(devDocsPath, "utf-8");
    return {
        blockchain: parseDocumentSections(blockchainContent),
        devDocs: parseDocumentSections(devDocsContent)
    };
}
server.setRequestHandler(types_js_1.ListToolsRequestSchema, function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        return [2 /*return*/, {
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
            }];
    });
}); });
server.setRequestHandler(types_js_1.CallToolRequestSchema, function (request) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, name, args, docs, _b, query_1, _c, category, language_1, sections, results, response, _d, api_name_1, language_2, allSections, apiSections, filteredSections, response, _e, category, sections, apiList;
    return __generator(this, function (_f) {
        _a = request.params, name = _a.name, args = _a.arguments;
        try {
            docs = loadDocuments();
            switch (name) {
                case "search_zilliqa_docs": {
                    _b = args, query_1 = _b.query, _c = _b.category, category = _c === void 0 ? "all" : _c, language_1 = _b.language;
                    sections = [];
                    if (category === "all") {
                        sections = __spreadArray(__spreadArray([], docs.blockchain, true), docs.devDocs, true);
                    }
                    else if (category === "blockchain") {
                        sections = docs.blockchain;
                    }
                    else if (category === "devdocs") {
                        sections = docs.devDocs;
                    }
                    results = sections.filter(function (section) {
                        var _a;
                        var matchesQuery = section.title.toLowerCase().includes(query_1.toLowerCase()) ||
                            section.description.toLowerCase().includes(query_1.toLowerCase()) ||
                            section.content.toLowerCase().includes(query_1.toLowerCase());
                        var matchesLanguage = !language_1 || ((_a = section.language) === null || _a === void 0 ? void 0 : _a.toLowerCase()) === language_1.toLowerCase();
                        return matchesQuery && matchesLanguage;
                    });
                    if (results.length === 0) {
                        return [2 /*return*/, {
                                content: [
                                    {
                                        type: "text",
                                        text: "No documentation found for query: \"".concat(query_1, "\"").concat(language_1 ? " in language: ".concat(language_1) : ""),
                                    },
                                ],
                            }];
                    }
                    response = results.map(function (section) {
                        return "**".concat(section.title, "**\n").concat(section.description, "\n\n").concat(section.language ? "Language: ".concat(section.language, "\n") : "").concat(section.code ? "```".concat(section.language, "\n").concat(section.code, "\n```") : "", "\n\nSource: ").concat(section.source, "\n");
                    }).join("\n---\n\n");
                    return [2 /*return*/, {
                            content: [
                                {
                                    type: "text",
                                    text: response,
                                },
                            ],
                        }];
                }
                case "get_zilliqa_api_example": {
                    _d = args, api_name_1 = _d.api_name, language_2 = _d.language;
                    allSections = __spreadArray(__spreadArray([], docs.blockchain, true), docs.devDocs, true);
                    apiSections = allSections.filter(function (section) {
                        return section.title.toLowerCase().includes(api_name_1.toLowerCase());
                    });
                    if (apiSections.length === 0) {
                        return [2 /*return*/, {
                                content: [
                                    {
                                        type: "text",
                                        text: "No API examples found for: \"".concat(api_name_1, "\""),
                                    },
                                ],
                            }];
                    }
                    filteredSections = apiSections;
                    if (language_2) {
                        filteredSections = apiSections.filter(function (section) { var _a; return ((_a = section.language) === null || _a === void 0 ? void 0 : _a.toLowerCase()) === language_2.toLowerCase(); });
                        if (filteredSections.length === 0) {
                            return [2 /*return*/, {
                                    content: [
                                        {
                                            type: "text",
                                            text: "No examples found for \"".concat(api_name_1, "\" in language: ").concat(language_2, "\n\nAvailable languages: ").concat(Array.from(new Set(apiSections.map(function (s) { return s.language; }).filter(Boolean))).join(", ")),
                                        },
                                    ],
                                }];
                        }
                    }
                    response = filteredSections.map(function (section) {
                        return "**".concat(section.title, "**\n").concat(section.description, "\n\n").concat(section.language ? "Language: ".concat(section.language, "\n") : "").concat(section.code ? "```".concat(section.language, "\n").concat(section.code, "\n```") : "", "\n\nSource: ").concat(section.source, "\n");
                    }).join("\n---\n\n");
                    return [2 /*return*/, {
                            content: [
                                {
                                    type: "text",
                                    text: response,
                                },
                            ],
                        }];
                }
                case "list_zilliqa_apis": {
                    _e = args.category, category = _e === void 0 ? "all" : _e;
                    sections = [];
                    if (category === "all") {
                        sections = __spreadArray(__spreadArray([], docs.blockchain, true), docs.devDocs, true);
                    }
                    else if (category === "blockchain") {
                        sections = docs.blockchain;
                    }
                    else if (category === "devdocs") {
                        sections = docs.devDocs;
                    }
                    apiList = sections.map(function (section) {
                        return "\u2022 **".concat(section.title, "**").concat(section.language ? " (".concat(section.language, ")") : "", "\n  ").concat(section.description);
                    }).join("\n");
                    return [2 /*return*/, {
                            content: [
                                {
                                    type: "text",
                                    text: "**Available Zilliqa APIs (".concat(category, "):**\n\n").concat(apiList),
                                },
                            ],
                        }];
                }
                default:
                    throw new Error("Unknown tool: ".concat(name));
            }
        }
        catch (error) {
            throw new Error("Tool execution failed: ".concat(error instanceof Error ? error.message : String(error)));
        }
        return [2 /*return*/];
    });
}); });
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var transport;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    transport = new stdio_js_1.StdioServerTransport();
                    return [4 /*yield*/, server.connect(transport)];
                case 1:
                    _a.sent();
                    console.error("Zilliqa MCP Server running on stdio");
                    return [2 /*return*/];
            }
        });
    });
}
main().catch(console.error);
