#!/usr/bin/env node
/**
 * Codex Control MCP Server
 *
 * MCP server for programmatic control of OpenAI Codex via Claude Code.
 * Provides tools for executing, planning, and applying Codex tasks.
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, ListResourcesRequestSchema, ReadResourceRequestSchema, } from '@modelcontextprotocol/sdk/types.js';
import { ProcessManager } from './executor/process_manager.js';
import { RunTool } from './tools/cli_run.js';
import { PlanTool } from './tools/cli_plan.js';
import { ApplyTool } from './tools/cli_apply.js';
import { StatusTool } from './tools/cli_status.js';
import { CloudSubmitTool, CloudStatusTool, CloudResultsTool, CloudListTasksTool, } from './tools/cloud.js';
import { GitHubSetupTool } from './tools/github_setup.js';
import { LocalExecTool } from './tools/local_exec.js';
import { LocalResumeTool } from './tools/local_resume.js';
import { CloudCheckReminderTool } from './tools/cloud_check_reminder.js';
import { ListEnvironmentsTool } from './tools/list_environments.js';
import { LocalStatusTool } from './tools/local_status.js';
import { LocalResultsTool } from './tools/local_results.js';
import { templates } from './resources/environment_templates.js';
/**
 * Server Configuration
 */
const MAX_CONCURRENCY = parseInt(process.env.CODEX_MAX_CONCURRENCY || '2', 10);
const SERVER_NAME = 'codex-control';
const SERVER_VERSION = '2.1.1';
/**
 * Main Server Class
 */
class CodexControlServer {
    server;
    processManager;
    runTool;
    planTool;
    applyTool;
    statusTool;
    cloudSubmitTool;
    cloudStatusTool;
    cloudResultsTool;
    cloudListTasksTool;
    githubSetupTool;
    localExecTool;
    localResumeTool;
    cloudCheckReminderTool;
    listEnvironmentsTool;
    localStatusTool;
    localResultsTool;
    constructor() {
        // Initialize process manager
        this.processManager = new ProcessManager(MAX_CONCURRENCY);
        // Initialize tools
        this.runTool = new RunTool(this.processManager);
        this.planTool = new PlanTool(this.processManager);
        this.applyTool = new ApplyTool(this.processManager);
        this.statusTool = new StatusTool(this.processManager);
        this.cloudSubmitTool = new CloudSubmitTool();
        this.cloudStatusTool = new CloudStatusTool();
        this.cloudResultsTool = new CloudResultsTool();
        this.cloudListTasksTool = new CloudListTasksTool();
        this.githubSetupTool = new GitHubSetupTool();
        this.localExecTool = new LocalExecTool();
        this.localResumeTool = new LocalResumeTool();
        this.cloudCheckReminderTool = new CloudCheckReminderTool();
        this.listEnvironmentsTool = new ListEnvironmentsTool();
        this.localStatusTool = new LocalStatusTool();
        this.localResultsTool = new LocalResultsTool();
        // Create MCP server
        this.server = new Server({
            name: SERVER_NAME,
            version: SERVER_VERSION,
        }, {
            capabilities: {
                tools: {},
                resources: {},
            },
        });
        // Register handlers
        this.setupHandlers();
        // Setup graceful shutdown
        this.setupShutdown();
    }
    /**
     * Setup MCP request handlers
     */
    setupHandlers() {
        // List available tools
        this.server.setRequestHandler(ListToolsRequestSchema, async () => {
            return {
                tools: [
                    RunTool.getSchema(),
                    PlanTool.getSchema(),
                    ApplyTool.getSchema(),
                    StatusTool.getSchema(),
                    CloudSubmitTool.getSchema(),
                    CloudStatusTool.getSchema(),
                    CloudResultsTool.getSchema(),
                    CloudListTasksTool.getSchema(),
                    GitHubSetupTool.getSchema(),
                    LocalExecTool.getSchema(),
                    LocalResumeTool.getSchema(),
                    CloudCheckReminderTool.getSchema(),
                    ListEnvironmentsTool.getSchema(),
                    LocalStatusTool.getSchema(),
                    LocalResultsTool.getSchema(),
                ],
            };
        });
        // Handle tool calls
        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;
            try {
                switch (name) {
                    case 'codex_cli_run':
                        return await this.runTool.execute(args);
                    case 'codex_cli_plan':
                        return await this.planTool.execute(args);
                    case 'codex_cli_apply':
                        return await this.applyTool.execute(args);
                    case 'codex_cli_status':
                        return await this.statusTool.execute(args);
                    case 'codex_cloud_submit':
                        return await this.cloudSubmitTool.execute(args);
                    case 'codex_cloud_status':
                        return await this.cloudStatusTool.execute(args);
                    case 'codex_cloud_results':
                        return await this.cloudResultsTool.execute(args);
                    case 'codex_cloud_list_tasks':
                        return await this.cloudListTasksTool.execute(args);
                    case 'codex_github_setup_guide':
                        return await this.githubSetupTool.execute(args);
                    case 'codex_local_exec':
                        return await this.localExecTool.execute(args);
                    case 'codex_local_resume':
                        return await this.localResumeTool.execute(args);
                    case 'codex_cloud_check_reminder':
                        return await this.cloudCheckReminderTool.execute();
                    case 'codex_list_environments':
                        return await this.listEnvironmentsTool.execute();
                    case 'codex_local_status':
                        return await this.localStatusTool.execute(args);
                    case 'codex_local_results':
                        return await this.localResultsTool.execute(args);
                    default:
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: `❌ Unknown tool: ${name}`,
                                },
                            ],
                            isError: true,
                        };
                }
            }
            catch (error) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: `❌ Tool execution failed: ${error instanceof Error ? error.message : String(error)}`,
                        },
                    ],
                    isError: true,
                };
            }
        });
        // List available resources (environment templates)
        this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
            return {
                resources: templates.map((t) => ({
                    uri: `codex://environment-template/${t.name}`,
                    name: `Environment Template: ${t.name}`,
                    description: t.description,
                    mimeType: 'application/json',
                })),
            };
        });
        // Read specific resource (environment template)
        this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
            const uri = request.params.uri;
            const match = uri.match(/^codex:\/\/environment-template\/(.+)$/);
            if (match) {
                const template = templates.find((t) => t.name === match[1]);
                if (template) {
                    return {
                        contents: [
                            {
                                uri,
                                mimeType: 'application/json',
                                text: JSON.stringify(template, null, 2),
                            },
                        ],
                    };
                }
            }
            throw new Error(`Resource not found: ${uri}`);
        });
    }
    /**
     * Setup graceful shutdown
     */
    setupShutdown() {
        const shutdown = async () => {
            console.error('[CodexControl] Shutting down...');
            // Kill any running Codex processes
            this.processManager.killAll();
            // Close server
            await this.server.close();
            process.exit(0);
        };
        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);
    }
    /**
     * Start the server
     */
    async start() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.error(`[CodexControl] Server started successfully`);
        console.error(`[CodexControl] Name: ${SERVER_NAME}`);
        console.error(`[CodexControl] Version: ${SERVER_VERSION}`);
        console.error(`[CodexControl] Max Concurrency: ${MAX_CONCURRENCY}`);
        console.error(`[CodexControl] Tools: codex_cli_run, codex_cli_plan, codex_cli_apply, codex_cli_status, codex_cloud_submit, codex_cloud_status, codex_cloud_results, codex_cloud_list_tasks, codex_github_setup_guide, codex_local_exec, codex_local_resume, codex_cloud_check_reminder, codex_list_environments, codex_local_status, codex_local_results`);
        console.error(`[CodexControl] Resources: ${templates.length} environment templates`);
    }
}
/**
 * Main entry point
 */
async function main() {
    try {
        const server = new CodexControlServer();
        await server.start();
    }
    catch (error) {
        console.error('[CodexControl] Fatal error:', error);
        process.exit(1);
    }
}
// Run server
main();
//# sourceMappingURL=index.js.map