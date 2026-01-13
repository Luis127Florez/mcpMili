import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import z from "zod";

export const registerGitTools = (server: McpServer) => {
  server.registerTool(
    "GIT_PUSH_FEATURE",
    {
      description:
        "Automate git flow: checkout new feature branch, add, commit, and push.",
      inputSchema: z.object({
        projectPath: z.string().describe("The root directory of the project"),
        branchName: z
          .string()
          .describe(
            "The name of the feature branch (suffix only, e.g. 'tkLoginFix')"
          ),
        commitMessage: z.string().describe("The commit message"),
        preview: z
          .boolean()
          .optional()
          .describe(
            "If true (default), returns the commands that would be executed without running them. Set to false to execute."
          ),
      }),
    },
    async ({ projectPath, branchName, commitMessage, preview = true }) => {
      const fullBranchName = `feature/${branchName}`;

      if (preview) {
        return {
          content: [
            {
              type: "text",
              text: `[PREVIEW] GIT_PUSH_FEATURE
Path: ${projectPath}
Target Branch: ${fullBranchName}
Commit Message: "${commitMessage}"

Planned Commands:
1. git pull origin develop
2. git checkout -b ${fullBranchName}
3. git add .
4. git commit -m "${commitMessage.replace(/"/g, '\\"')}"
5. git push --set-upstream origin ${fullBranchName}

To execute these commands, call this tool again with 'preview: false'.`,
            },
          ],
        };
      }

      try {
        const { exec } = await import("node:child_process");
        const util = await import("node:util");
        const execAsync = util.promisify(exec);

        // Chain commands
        await execAsync(`git pull origin develop`, { cwd: projectPath });

        // 1. Checkout new branch
        await execAsync(`git checkout -b ${fullBranchName}`, {
          cwd: projectPath,
        });

        // 2. Add all changes
        await execAsync(`git add .`, { cwd: projectPath });

        // 3. Commit
        // Escape commit message just in case
        const safeMessage = commitMessage.replace(/"/g, '\\"');
        await execAsync(`git commit -m "${safeMessage}"`, { cwd: projectPath });

        // 4. Push
        const { stdout, stderr } = await execAsync(
          `git push --set-upstream origin ${fullBranchName}`,
          { cwd: projectPath }
        );

        return {
          content: [
            {
              type: "text",
              text: `Git flow completed successfully for branch ${fullBranchName}.\n\nOutput:\n${stdout}\n${stderr}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error executing git flow: ${
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
    "GIT_RUN_COMMAND",
    {
      description:
        "Run a custom git command to inspect changes or history (e.g., 'show HEAD', 'diff', 'log').",
      inputSchema: z.object({
        projectPath: z.string().describe(`The root directory of the project e.g., 'C:\\Users\\Wow\\Desktop\\wow\\Mili%20Paco'; 'C:\\Users\\Wow\\Desktop\\wow\\Mili_Seller'; 'C:\\Users\\Wow\\Desktop\\wow\\Mili%20New-Back'`),
        commandArgs: z
          .string()
          .describe(
            "The git command arguments (e.g. 'show --stat', 'diff HEAD^ HEAD'). Do not include 'git' at the start."
          ),
      }),
    },
    async ({ projectPath, commandArgs }) => {
      try {
        const { exec } = await import("node:child_process");
        const util = await import("node:util");
        const execAsync = util.promisify(exec);

        // Execute the git command
        const { stdout, stderr } = await execAsync(`git ${commandArgs}`, {
          cwd: projectPath,
          maxBuffer: 1024 * 1024 * 10, // 10MB buffer for large diffs
        });

        return {
          content: [
            {
              type: "text",
              text: `Git command 'git ${commandArgs}' output:\n\n${stdout}\n${stderr}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error executing git command: ${
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
