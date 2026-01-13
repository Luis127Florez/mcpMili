import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as fs from 'fs';
import * as path from 'path';

// Helper to get ignore list
const DEFAULT_IGNORE = ['.git', 'node_modules', 'dist', 'coverage', '.DS_Store', 'build', '.next'];

function getStructure(dir: string, depth: number, currentDepth: number = 0): string {
    if (currentDepth > depth) return '';
    
    let output = '';
    let items: string[];
    
    try {
        items = fs.readdirSync(dir);
    } catch (e) {
        return ''; // Return empty if directory cannot be read
    }
    
    // Sort directories first, then files
    items.sort((a, b) => {
        const fullPathA = path.join(dir, a);
        const fullPathB = path.join(dir, b);
        let statA, statB;
        try {
            statA = fs.statSync(fullPathA);
            statB = fs.statSync(fullPathB);
        } catch(e) { 
            return 0; // Treat as equal if stat fails
        }
        
        if (statA.isDirectory() && !statB.isDirectory()) return -1;
        if (!statA.isDirectory() && statB.isDirectory()) return 1;
        return a.localeCompare(b);
    });

    for (const item of items) {
        if (DEFAULT_IGNORE.includes(item)) continue;
        
        const fullPath = path.join(dir, item);
        let stats;
        try {
            stats = fs.statSync(fullPath);
        } catch(e) {
            continue;
        }

        const indent = '  '.repeat(currentDepth);
        
        if (stats.isDirectory()) {
            output += `${indent}[DIR] ${item}/\n`;
            if (currentDepth < depth) {
                output += getStructure(fullPath, depth, currentDepth + 1);
            }
        } else {
            output += `${indent}${item}\n`;
        }
    }
    return output;
}

function searchFiles(dir: string, query: string, caseSensitive: boolean = false): string[] {
    let results: string[] = [];
    let items: string[] = [];
    
    try {
        items = fs.readdirSync(dir);
    } catch(e) {
        return [];
    }

    for (const item of items) {
         if (DEFAULT_IGNORE.includes(item)) continue;
         
         const fullPath = path.join(dir, item);
         let stats;
         try {
             stats = fs.statSync(fullPath);
         } catch(e) {
             continue;
         }

         if (stats.isDirectory()) {
             results = results.concat(searchFiles(fullPath, query, caseSensitive));
         } else {
             try {
                 const content = fs.readFileSync(fullPath, 'utf-8');
                 // Simple text check, can be improved with regex if needed but keeping it simple for now
                 const match = caseSensitive ? content.includes(query) : content.toLowerCase().includes(query.toLowerCase());
                 if (match) {
                     results.push(fullPath);
                 }
             } catch (e) {
                 // Ignore read errors (binary files etc)
             }
         }
    }
    return results;
}

export const registerProjectTools = (server: McpServer) => {
    server.registerTool(
        "mili_get_structure",
        {
            description: "Get the file structure of the project directory. Useful for understanding project layout without reading every file.",
            inputSchema: z.object({
                absolutePath: z.string().describe("The absolute path of the root directory to scan"),
                depth: z.number().optional().describe("Depth of recursion (default 2)")
            })
        },
        async ({ absolutePath, depth }) => {
            try {
                if (!fs.existsSync(absolutePath)) {
                     return {
                        content: [{ type: "text", text: `Path not found: ${absolutePath}` }],
                        isError: true
                    };
                }
                const structure = getStructure(absolutePath, depth ?? 2);
                return {
                    content: [{ type: "text", text: structure || "(Empty or no accessible files)" }]
                };
            } catch (error: any) {
                return {
                    content: [{ type: "text", text: `Error: ${error.message}` }],
                    isError: true
                };
            }
        }
    );

    server.registerTool(
        "mili_search_project",
        {
            description: "Search for a string in all files within a directory. Returns list of files containing the string.",
            inputSchema: z.object({
                absolutePath: z.string().describe("The absolute path of the root directory to search"),
                query: z.string().describe("The string to search for"),
                caseSensitive: z.boolean().optional().describe("Whether search should be case sensitive")
            })
        },
        async ({ absolutePath, query, caseSensitive }) => {
             try {
                if (!fs.existsSync(absolutePath)) {
                     return {
                        content: [{ type: "text", text: `Path not found: ${absolutePath}` }],
                        isError: true
                    };
                }
                const matches = searchFiles(absolutePath, query, caseSensitive);
                return {
                    content: [{ type: "text", text: matches.length > 0 ? `Found "${query}" in:\n${matches.join('\n')}` : "No matches found." }]
                };
            } catch (error: any) {
                return {
                    content: [{ type: "text", text: `Error: ${error.message}` }],
                    isError: true
                };
            }
        }
    );
};
