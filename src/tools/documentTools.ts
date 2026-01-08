import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import z from "zod";
import { v4 as uuidv4 } from "uuid";
import { pool } from "../config/db.js";

export const registerDocumentTools = (server: McpServer) => {
  server.registerTool(
    "CREATE_NEW_DOCUMENT",
    {
      description: "create a new document in mili with associated html content and this html content must be compatible with jodit react editor",
      inputSchema: z.object({
        title: z.string().describe("The name of the document (dcName)"),
        content: z
          .string()
          .describe(
            "The HTML content of the document (dchContent). This must be well-formatted HTML to look good for the user. the html must be compatible with jodit react editor"
          ),
        route: z
          .string()
          .describe("The S3 path or route for the document (dchRoute)"),
        pages: z
          .number()
          .int()
          .default(1)
          .describe("Number of pages (dcPages, dchPages)"),
      }),
    },
    async ({ title, content, route, pages }) => {
      const dcId = uuidv4();
      const dchId = uuidv4();
      const now = new Date();

      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();

        // Insert into documentContracts
        await connection.execute(
          `INSERT INTO documentContracts (dcId, dcName, dcDocument, dcPages, dcType, dcState, dcDatCre, dcDatMod) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [dcId, title, "HTML", pages, 1, 1, now, now]
        );

        // Insert into documentContentHTMLs
        await connection.execute(
          `INSERT INTO documentContentHTMLs (dchId, dchContent, dcId, dchDatCre, dchDatMod, dchState, dchRoute, dchPages) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [dchId, content, dcId, now, now, 1, route, pages]
        );

        await connection.commit();

        return {
          content: [
            {
              type: "text",
              text: `Document created successfully. dcId: ${dcId}, dchId: ${dchId}`,
            },
          ],
        };
      } catch (error) {
        await connection.rollback();
        return {
          content: [
            {
              type: "text",
              text: `Error creating document: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
          isError: true,
        };
      } finally {
        connection.release();
      }
    }
  );
};
