#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    PromptMessage,
    TextContent,
    ListToolsRequestSchema,
    ListPromptsRequestSchema,
    GetPromptRequestSchema,
    CallToolResult,
} from "@modelcontextprotocol/sdk/types.js";
import { readFile, writeFile, appendFile } from "fs/promises";
import { existsSync } from "fs";

import { createRequire } from "module";
import { always_log, verbose_log } from "./logs.js";
import {
    listMemory,
    appendMemory,
    deleteMemory,
    searchMemory,
} from "./memories.js";

const createServer = async () => {
    const require = createRequire(import.meta.url);
    const {
        name: package_name,
        version: package_version,
    } = require("../package.json");

    const server = new Server(
        // PRN inline the destructuring of package.json here should work fine
        {
            name: package_name,
            version: package_version,
            //description: "Run commands on this " + os.platform() + " machine",
        },
        {
            capabilities: {
                //resources: {},
                tools: {},
                //prompts: {},
                //logging: {}, // for logging messages that don't seem to work yet or I am doing them wrong
            },
        }
    );

    server.setRequestHandler(ListToolsRequestSchema, async () => {
        verbose_log("INFO: ListTools");
        //let memories = await readMemories();
        //verbose_log("INFO: memories", memories);
        //if (memories) {
        //    memories = "Here are some of your memories:\n" + memories;
        //}
        return {
            tools: [
                {
                    name: "add_memory",
                    description: "Add a new memory entry",
                    inputSchema: {
                        type: "object",
                        properties: {
                            text: {
                                type: "string",
                            },
                        },
                        required: ["text"],
                    },
                },
                {
                    name: "search_memory",
                    description: "Return memory entries containing the query",
                    inputSchema: {
                        type: "object",
                        properties: {
                            query: {
                                type: "string",
                            },
                            // PRN no query == ALL? then get rid of list_memory?
                        },
                        required: ["query"],
                    },
                },
                {
                    name: "delete_memory",
                    description: "Delete memory entries containing the query",
                    inputSchema: {
                        type: "object",
                        properties: {
                            query: {
                                type: "string",
                            },
                        },
                        required: ["query"],
                    },
                },
                {
                    name: "list_memory",
                    //description:
                    //    "List all memory entries, by the way here are some of your memories:" +
                    // !!! TODO test w/ and w/o these memory lines?
                    //    memories,
                    inputSchema: {
                        type: "object",
                    },
                },
                // IDEAS:
                // - extract_keywords/extract_word_cloud (pull from memories, like a word cloud, to help devise a search, esp if memory grows large - can even include frequency if useful, as a more salient memory!?)
                //    speaking of salience, what all could correlate to generate salience (i.e. emotional state in humans imbues salience, i.e. car crash you can remember minute details about a car that 20 years later you can't recall in general but for the accident)
                // - touch_memory
            ],
        };
    });

    server.setRequestHandler(
        CallToolRequestSchema,
        async (request): Promise<{ toolResult: CallToolResult }> => {
            verbose_log("INFO: ToolRequest", request);
            switch (request.params.name) {
                case "add_memory": {
                    return {
                        toolResult: await addMemory(request.params.arguments),
                    };
                }
                case "list_memory": {
                    return {
                        toolResult: await listMemory(),
                    };
                }
                case "search_memory": {
                    const query = request.params.arguments?.query as string;
                    if (!query) {
                        throw new Error("query is required");
                    }
                    return {
                        toolResult: await searchMemory(query),
                    };
                }
                case "delete_memory": {
                    const query = request.params.arguments?.query as string;
                    if (!query) {
                        throw new Error("query is required");
                    }
                    return {
                        toolResult: await deleteMemory(query),
                    };
                }
                default:
                    throw new Error("Unknown tool");
            }
        }
    );

    async function addMemory(
        args: Record<string, unknown> | undefined
    ): Promise<CallToolResult> {
        const text = args?.text as string;
        if (!text) {
            throw new Error("Memory's text is required");
        }
        return appendMemory(text);
    }

    const transport = new StdioServerTransport();
    await server.connect(transport);
};

createServer().catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
});
