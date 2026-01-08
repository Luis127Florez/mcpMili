import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import z from "zod";

export const registerFileSystemTools = (server: McpServer) => {
  server.registerTool(
    "LIST_DIRECTORY",
    {
      description: "List files and directories in a given path",
      inputSchema: z.object({
        path: z.string().describe("The absolute path to the directory to list"),
      }),
    },
    async ({ path }) => {
      try {
        const fs = await import("node:fs/promises");
        const entries = await fs.readdir(path, { withFileTypes: true });
        const result = entries.map((entry) => ({
          name: entry.name,
          isDirectory: entry.isDirectory(),
        }));
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error listing directory: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "READ_FILE",
    {
      description: "Read the content of a file",
      inputSchema: z.object({
        path: z.string().describe("The absolute path to the file to read"),
      }),
    },
    async ({ path }) => {
      try {
        const fs = await import("node:fs/promises");
        const content = await fs.readFile(path, "utf-8");
        return {
          content: [
            {
              type: "text",
              text: content,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error reading file: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "WRITE_FILE",
    {
      description: "Write content to a file. Overwrites if it exists, creates if not.",
      inputSchema: z.object({
        path: z.string().describe("The absolute path to the file to write"),
        content: z.string().describe("The content to write to the file"),
      }),
    },
    async ({ path, content }) => {
      try {
        const fs = await import("node:fs/promises");
        await fs.writeFile(path, content, "utf-8");
        return {
          content: [
            {
              type: "text",
              text: `Successfully wrote to ${path}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error writing file: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
          isError: true,
        };
      }
    }
  );
};
