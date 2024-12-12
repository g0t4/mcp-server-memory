import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { readFile, writeFile, appendFile } from "fs/promises";
import { existsSync } from "fs";
import { z } from "zod";

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

  const server = new Server({
    name: "mcp-server-memory",
    version: "1.0.0",
    tools: [
      {
        name: "memory_add",
        description: "Add a new memory entry",
        parameters: AddParams,
        handler: async (params: z.infer<typeof AddParams>) => {
          await appendFile(MEMORY_FILE, params.content + "\n", "utf-8");
          return { success: true };
        },
      },
      {
        name: "memory_search",
        description: "Search memory entries",
        parameters: SearchParams,
        handler: async (params: z.infer<typeof SearchParams>) => {
          const content = await readFile(MEMORY_FILE, "utf-8");
          const lines = content.split("\n").filter(line => line.trim());
          const matches = lines.filter(line => 
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
          const lines = content.split("\n").filter(line => line.trim());
          const remaining = lines.filter(line => 
            !line.toLowerCase().includes(params.search_term.toLowerCase())
          );
          await writeFile(MEMORY_FILE, remaining.join("\n") + "\n", "utf-8");
          return { success: true };
        },
      },
      {
        name: "memory_list",
        description: "List all memory entries",
        parameters: z.object({}),
        handler: async () => {
          const content = await readFile(MEMORY_FILE, "utf-8");
          const lines = content.split("\n").filter(line => line.trim());
          return { memories: lines };
        },
      },
    ],
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
};

createServer().catch(console.error);