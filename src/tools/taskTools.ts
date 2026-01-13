import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as fs from 'fs';
import * as path from 'path';

export const registerTaskTools = (server: McpServer) => {
    server.registerTool(
        "mili_manage_task",
        {
            description: "Manage the current active task state to persist context across agent restarts. Saves state to .mili/active_task.json in the project root.",
            inputSchema: z.object({
                projectPath: z.string().describe("The root directory of the project where .mili folder will be created"),
                action: z.enum(['start', 'read', 'update', 'complete']).describe("Action to perform"),
                taskName: z.string().optional().describe("Name of the task (required for start)"),
                status: z.string().optional().describe("Current status of the task"),
                plan: z.string().optional().describe("The plan or steps for the task"),
                notes: z.string().optional().describe("Any additional notes or progress updates to append to history")
            })
        },
        async ({ projectPath, action, taskName, status, plan, notes }) => {
            const miliDir = path.join(projectPath, '.mili');
            const taskFile = path.join(miliDir, 'active_task.json');

            try {
                if (!fs.existsSync(projectPath)) {
                     return {
                        content: [{ type: "text", text: `Project path not found: ${projectPath}` }],
                        isError: true
                    };
                }

                if (!fs.existsSync(miliDir)) {
                    fs.mkdirSync(miliDir, { recursive: true });
                }

                if (action === 'start') {
                    const taskData = {
                        name: taskName || 'Untitled Task',
                        startDate: new Date().toISOString(),
                        status: status || 'Pending',
                        plan: plan || '',
                        history: [{ date: new Date().toISOString(), note: 'Task started' }]
                    };
                    fs.writeFileSync(taskFile, JSON.stringify(taskData, null, 2));
                    return { content: [{ type: "text", text: `Task started successfully in ${taskFile}` }] };
                }

                if (action === 'read') {
                    if (!fs.existsSync(taskFile)) {
                         return { content: [{ type: "text", text: "No active task found. Use 'start' to create one." }] };
                    }
                    const content = fs.readFileSync(taskFile, 'utf-8');
                    return { content: [{ type: "text", text: content }] };
                }

                if (action === 'update') {
                     if (!fs.existsSync(taskFile)) {
                         return { content: [{ type: "text", text: "No active task found to update." }], isError: true };
                    }
                    const currentData = JSON.parse(fs.readFileSync(taskFile, 'utf-8'));
                    
                    if (taskName) currentData.name = taskName;
                    if (status) currentData.status = status;
                    if (plan) currentData.plan = plan;
                    if (notes) currentData.history.push({ date: new Date().toISOString(), note: notes });
                    
                    fs.writeFileSync(taskFile, JSON.stringify(currentData, null, 2));
                    return { content: [{ type: "text", text: "Task updated successfully." }] };
                }
                
                if (action === 'complete') {
                     if (!fs.existsSync(taskFile)) {
                         return { content: [{ type: "text", text: "No active task found." }] };
                    }
                    const currentData = JSON.parse(fs.readFileSync(taskFile, 'utf-8'));
                    currentData.status = 'Completed';
                    currentData.completedDate = new Date().toISOString();
                    
                    // Archive to history
                    const historyFile = path.join(miliDir, 'task_history.jsonl');
                    fs.appendFileSync(historyFile, JSON.stringify(currentData) + '\n');
                    
                    // Delete active task
                    fs.unlinkSync(taskFile);
                    
                    return { content: [{ type: "text", text: "Task completed and archived to task_history.jsonl." }] };
                }

                return { content: [{ type: "text", text: "Invalid action." }], isError: true };

            } catch (error: any) {
                return {
                    content: [{ type: "text", text: `Error managing task: ${error.message}` }],
                    isError: true
                };
            }
        }
    );
};
