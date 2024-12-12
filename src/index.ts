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
import { z } from "zod";
import { createRequire } from "module";
import { always_log, verbose_log } from "./logs.js";

const MEMORY_FILE = "memory.txt";

const AddParams = z.object({
    content: z.string(),
});

const SearchParams = z.object({
    query: z.string(),
});

const DeleteParams = z.object({
    search_term: z.string(),
});

const createServer = async () => {
    if (!existsSync(MEMORY_FILE)) {
        await writeFile(MEMORY_FILE, "", "utf-8");
    }

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

    const foo = {
        tools: [
            {
                name: "memory_add",
                description: "Add a new memory entry",
                parameters: AddParams,
                handler: async (params: z.infer<typeof AddParams>) => {
                    await appendFile(
                        MEMORY_FILE,
                        params.content + "\n",
                        "utf-8"
                    );
                    return { success: true };
                },
            },
            {
                name: "memory_search",
                description: "Search memory entries",
                parameters: SearchParams,
                handler: async (params: z.infer<typeof SearchParams>) => {
                    const content = await readFile(MEMORY_FILE, "utf-8");
                    const lines = content
                        .split("\n")
                        .filter((line) => line.trim());
                    const matches = lines.filter((line) =>
                        line.toLowerCase().includes(params.query.toLowerCase())
                    );
                    return { matches };
                },
            },
            {
                name: "memory_delete",
                description: "Delete memory entries containing the search term",
                parameters: DeleteParams,
                handler: async (params: z.infer<typeof DeleteParams>) => {
                    const content = await readFile(MEMORY_FILE, "utf-8");
                    const lines = content
                        .split("\n")
                        .filter((line) => line.trim());
                    const remaining = lines.filter(
                        (line) =>
                            !line
                                .toLowerCase()
                                .includes(params.search_term.toLowerCase())
                    );
                    await writeFile(
                        MEMORY_FILE,
                        remaining.join("\n") + "\n",
                        "utf-8"
                    );
                    return { success: true };
                },
            },
            {
                name: "memory_list",
                description: "List all memory entries",
                parameters: z.object({}),
                handler: async () => {
                    const content = await readFile(MEMORY_FILE, "utf-8");
                    const lines = content
                        .split("\n")
                        .filter((line) => line.trim());
                    return { memories: lines };
                },
            },
        ],
    };

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
                    name: "run_command",
                    //description: "Run a command on this " + os.platform() + " machine",
                    // FYI what I am doing here is basically adding to the "system prompt" if you will with memory entries... another way might be to extract keywords from memory so Claude knows when to query it for more details (and for what search terms)... thats if the memory gets too large to include here
                    description: reminders, // Claude seems to be using these for run_script too (at least once it worked to use run_script to amend reminders file)
                    inputSchema: {
                        type: "object",
                        properties: {
                            command: {
                                type: "string",
                                description: "Command with args",
                            },
                            cwd: {
                                // previous run_command calls can probe the filesystem and find paths to change to
                                type: "string",
                                description:
                                    "Current working directory, leave empty in most cases",
                            },
                            // FYI using child_process.exec runs command in a shell, so you can pass a script here too but I still think separate tools would be helpful?
                            //   FYI gonna use execFile for run_script
                            // - env - obscure cases where command takes a param only via an env var?
                            // args to consider:
                            // - timeout - lets just hard code this for now
                            // - shell - (cmd/args) - for now use run_script for this case, also can just pass "fish -c 'command'" or "sh ..."
                            // - stdin? though this borders on the run_script below
                            // - capture_output (default true) - for now can just redirect to /dev/null - perhaps capture_stdout/capture_stderr
                        },
                        required: ["command"],
                    },
                },
                // PRN tool to introspect the environment (i.e. windows vs linux vs mac, maybe default shell, etc?) - for now LLM can run commands and when they fail it can make adjustments accordingly - some cases where knowing this would help avoid dispatching erroneous commands (i.e. using free on linux, vm_stat on mac)
                {
                    name: "run_script",
                    inputSchema: {
                        type: "object",
                        properties: {
                            interpreter: {
                                type: "string",
                                description:
                                    "Command with arguments. Script will be piped to stdin. Examples: bash, fish, zsh, python, or: bash --norc",
                            },
                            script: {
                                type: "string",
                                description: "Script to run",
                            },
                            cwd: {
                                type: "string",
                                description: "Current working directory",
                            },
                        },
                        required: ["script"],
                    },
                },
            ],
        };
    });

    const transport = new StdioServerTransport();
    await server.connect(transport);
};

createServer().catch(console.error);
