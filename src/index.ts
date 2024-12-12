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
import { readMemories } from "./memories.js";

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
                prompts: {},
                //logging: {}, // for logging messages that don't seem to work yet or I am doing them wrong
            },
        }
    );

    server.setRequestHandler(ListToolsRequestSchema, async () => {
        verbose_log("INFO: ListTools");
        let reminders = await readReminders();
        verbose_log("INFO: reminders", reminders);
        if (reminders) {
            reminders =
                "Here are some reminders you left yourself from past usage:\n" +
                reminders;
        }
        return {
            tools: [
                {
                    name: "memory_add",
                    description: "Add a new memory entry",
                    inputSchema: {
                        type: "object",
                        properties: {
                            content: {
                                type: "string",
                                description: "Content to add",
                            },
                        },
                        required: ["content"],
                    },
                },
                {
                    name: "memory_search",
                    description: "Search memory entries",
                    inputSchema: {
                        type: "object",
                        properties: {
                            query: {
                                type: "string",
                                description: "Search term",
                            },
                        },
                    },
                },
                {
                    name: "memory_delete",
                    description:
                        "Delete memory entries containing the search term",
                    inputSchema: {
                        type: "object",
                        properties: {
                            search_term: {
                                type: "string",
                                description: "Search term to delete",
                            },
                        },
                        required: ["search_term"],
                    },
                },
                {
                    name: "memory_list",
                    description: "List all memory entries",
                    inputSchema: {},
                },
            ],
        };
    });

    const transport = new StdioServerTransport();
    await server.connect(transport);
};

createServer().catch(console.error);
