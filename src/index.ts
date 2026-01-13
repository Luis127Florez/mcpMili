import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { server } from "./server.js";
import { registerDocumentTools } from "./tools/documentTools.js";
// import { registerFileSystemTools } from "./tools/fileSystemTools.js";
import { registerGitTools } from "./tools/gitTools.js";
import { registerMiliTools } from "./tools/miliTools.js";
import { registerProjectTools } from "./tools/projectTools.js";
import { registerTaskTools } from "./tools/taskTools.js";

// Register tools
registerDocumentTools(server);
// registerFileSystemTools(server);
registerGitTools(server);
registerMiliTools(server);
registerProjectTools(server);
registerTaskTools(server);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Mili MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
