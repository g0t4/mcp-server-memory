import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import { promises as fs } from "node:fs";
import { always_log, verbose_log } from "./logs.js";

// TODO add configurable path to this file (will fix pathing issues too)
// FYI pathing is to workaround no support for a cwd in claude_desktop_config.json (yet?)
import { fileURLToPath } from "url";
import { dirname } from "path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
let memories_file_path = __dirname + "/memories.txt";
verbose_log("INFO: memories file path", memories_file_path);

export async function readMemories(): Promise<string> {
    // if the file doesn't exist, treat that as NO memories
    const file_exists = await fs
        .access(memories_file_path, fs.constants.F_OK)
        .then(() => true) // if does exist, set to true
        .catch(() => false); // error callback only invoked if does not exist
    if (!file_exists) {
        // dont wanna log failures when the file is just not there
        return "";
    }

    return (await fs.readFile(memories_file_path, "utf8")) ?? "";
}

export async function appendMemory(memory: string): Promise<CallToolResult> {
    try {
        memory = memory.trim(); // trim trailing/leading whitespace (notably newlines)
        // TODO great case for a test case :)
        await fs.appendFile(memories_file_path, "\n" + memory); // FYI append will create or append
        return {
            isError: false,
            content: [],
        };
    } catch (error) {
        // TODO test by locking file and try to write (macOS) - or use readonly dir
        return errorResult("appendMemory", error);
    }
}

export async function listMemory(): Promise<CallToolResult> {
    try {
        return {
            isError: false,
            content: [
                {
                    type: "text", // IIUC only text or image, so leave new line delimited
                    text: await readMemories(),
                    name: "memories",
                },
            ],
        };
    } catch (error) {
        return errorResult("listMemory", error);
    }
}

function errorResult(what: string, error: any) {
    // TODO do I really want to return details here? or just log those?
    const message = error instanceof Error ? error.message : String(error);
    const response: CallToolResult = {
        isError: true,
        content: [
            {
                type: "text",
                text: message,
                name: "error",
            },
        ],
    };
    always_log(`WARN: ${what} failed`, response);
    return response;
}

export async function deleteMemory(query: string): Promise<CallToolResult> {
    query = query.trim(); // trim trailing/leading whitespace (notably newlines)
    const memories = await readMemories();
    const lines = memories.split("\n");
    // TODO config formatter to knock it off adding () around single param lamdas
    const keep_memories = lines.filter((l) => !l.includes(query));
    try {
        await fs.writeFile(memories_file_path, keep_memories.join("\n"));
        return {
            isError: false,
            content: [],
        };
    } catch (error) {
        return errorResult("deleteMemory", error);
    }
}

export async function searchMemory(query: string): Promise<CallToolResult> {
    query = query.trim(); // trim trailing/leading whitespace (notably newlines)
    // TODO pass readMemories failure back as error too (in all uses of it, move into try{} block
    const memories = await readMemories();
    const lines = memories.split("\n");
    const keep_memories = lines.filter((l) => l.includes(query));
    return {
        isError: false,
        content: [
            {
                type: "text",
                text: keep_memories.join("\n"),
                name: "memories",
            },
        ],
    };
}
