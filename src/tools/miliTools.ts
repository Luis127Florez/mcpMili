import 'dotenv/config';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import axios from "axios";

// Workaround for import issue
type AxiosInstance = ReturnType<typeof axios.create>;

const MILI_REPOS: Record<string, string> = {
  "Mili Paco": "02941a9a-1897-4542-a075-72be67518b99",
  cxcBack: "95754590-b8ae-442c-bad7-6c9490a0e8ea",
  cxcFront: "78a27ae9-582a-4fad-a72a-c89f535d4c52",
  "Mili New-Back": "4f5ee3ce-2b3a-4c7d-b9dc-8dccad38787e",
  Mili_Company_PG: "99101cf4-cba3-460f-9b83-49e113d30312",
  MILI_LEGACY_APP_CLIENT: "1e0c8682-f7cc-415f-97e7-cc67bdca57d5",
  Mili_seller: "6b3fb8fa-6430-401c-8460-91034c522bed",
  MiliBackJuridico: "0f2f537d-468c-4dba-a793-449f961269a7",
  MiliFrontJuridico: "f5a4d5a2-382d-4884-8098-ef105daec2b7",
  "Mili-Front-Next": "7a48c858-cb7c-495f-bd21-b044f565d175",
  MiliNewBack_V2: "a71b1b27-3ef6-4aa6-8212-57b20237eb87",
  MiliNewFront_V2: "0084cfd3-beaf-41b8-a9dd-b7a80a9de879",
  MiliPGJuridico: "a74682b4-1df8-4591-8d07-c182631cd9cd",
};

// Also map IDs to themselves for flexibility
Object.values(MILI_REPOS).forEach((id) => {
  MILI_REPOS[id] = id;
});

type Auth = { type: "pat"; token: string } | { type: "bearer"; token: string };

interface CreatePrParams {
  organization: string;
  project: string;
  repository: string;
  sourceBranch: string;
  targetBranch?: string;
  title: string;
  description?: string;
  auth: Auth;
  apiVersion?: string;
}

function makeAxios(
  auth: Auth,
  baseUrl: string,
  apiVersion = "7.1"
): AxiosInstance {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (auth.type === "bearer") {
    headers["Authorization"] = `Bearer ${auth.token}`;
  } else if (auth.type === "pat") {
    const token = Buffer.from(":" + auth.token).toString("base64");
    headers["Authorization"] = `Basic ${token}`;
  }

  return axios.create({
    baseURL: baseUrl,
    headers,
    params: { "api-version": apiVersion },
  });
}

// Logic provided by user, adapted for fixed Org/Project
const ORGANIZATION = "wowdesarrollos";
const PROJECT_NAME = "Mili Paco";

interface CreatePrResult {
  ok: boolean;
  data?: any;
  status?: number;
  error?: any;
}

async function createPullRequest(
  params: CreatePrParams
): Promise<CreatePrResult> {
  const {
    organization,
    project,
    repository,
    sourceBranch,
    targetBranch = "develop",
    title,
    description = "",
    auth,
    apiVersion = "7.1",
  } = params;

  const baseUrl = `https://dev.azure.com/${organization}/${project}/_apis/`;
  const client = makeAxios(auth, baseUrl, apiVersion);

  // 1) Resolve repository ID
  let repoId = repository;
  // Check if it's a known name/alias first
  if (MILI_REPOS[repository]) {
    repoId = MILI_REPOS[repository];
  }

  // Try to ensure it's valid if not in our list (or if list lookup failed but it might be a valid ID passed directly)
  // The user's snippet had logic to check if it matches a GUID regex or fetch from API.
  // For now, we trust the map or the user input.

  // 2) Construct body
  const body = {
    sourceRefName: `refs/heads/${sourceBranch}`,
    targetRefName: `refs/heads/${targetBranch}`,
    title,
    description,
  };

  // 3) POST to create PR
  const createUrl = `git/repositories/${encodeURIComponent(
    repoId
  )}/pullrequests`;
  try {
    const resp = await client.post(createUrl, body);
    return {
      ok: true,
      data: resp.data,
    };
  } catch (error: any) {
    const status = error?.response?.status;
    const data = error?.response?.data;
    return {
      ok: false,
      status,
      error: data ?? error.message,
    };
  }
}

export const registerMiliTools = (server: McpServer) => {
  server.registerTool(
    "mili_create_pr",
    {
      description:
        "Creates a Pull Request in Azure DevOps for the Mili project. Target branch defaults to 'develop'.",
      inputSchema: z.object({
        repository: z
          .string()
          .describe("Repository name (e.g., 'Mili Paco', 'cxcBack') or ID."),
        sourceBranch: z
          .string()
          .describe("Source branch name (without refs/heads/)."),
        targetBranch: z
          .string()
          .optional()
          .describe("Target branch name (default: develop)."),
        title: z.string().describe("Title of the PR."),
        description: z.string().optional().describe("Description of the PR."),
        preview: z.boolean().optional().describe("If true (default), shows the PR details without creating it. Set to false to create."),
      }),
    },
    async ({ repository, sourceBranch, targetBranch, title, description, preview = true }) => {
      if (preview) {
        return {
          content: [
            {
              type: "text",
              text: `[PREVIEW] Create Pull Request
Repository: ${repository}
Source Branch: ${sourceBranch}
Target Branch: ${targetBranch || "develop"}
Title: ${title}
Description: ${description || "(none)"}

To create this Pull Request, call this tool again with 'preview: false'.`,
            },
          ],
        };
      }

      const token = process.env.AZURE_DEVOPS_TOKEN || process.env.AZURE_PAT;

      if (!token) {
        return {
          content: [
            {
              type: "text",
              text: "Error: AZURE_DEVOPS_TOKEN or AZURE_PAT environment variable not set.",
            },
          ],
          isError: true,
        };
      }

      const result = await createPullRequest({
        organization: ORGANIZATION,
        project: PROJECT_NAME,
        repository,
        sourceBranch,
        targetBranch: targetBranch || "develop",
        title,
        description,
        auth: { type: "bearer", token },
      });

      if (!result.ok) {
        return {
          content: [
            {
              type: "text",
              text: `Error creating PR: ${JSON.stringify(
                result.error || result.status
              )}`,
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: "text",
            text: `PR Created Successfully! ID: ${result.data?.pullRequestId}\nURL: ${result.data?.url}`,
          },
        ],
      };
    }
  );
};
