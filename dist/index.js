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
import { LocalRunTool } from './tools/local_run.js';
import { LocalStatusTool } from './tools/local_status.js';
import { CloudSubmitTool, CloudStatusTool, CloudResultsTool, } from './tools/cloud.js';
import { GitHubSetupTool } from './tools/github_setup.js';
import { LocalExecTool } from './tools/local_exec.js';
import { LocalResumeTool } from './tools/local_resume.js';
import { ListEnvironmentsTool } from './tools/list_environments.js';
import { LocalResultsTool } from './tools/local_results.js';
import { LocalWaitTool } from './tools/local_wait.js';
import { LocalCancelTool } from './tools/local_cancel.js';
import { CloudWaitTool } from './tools/cloud_wait.js';
import { CloudCancelTool } from './tools/cloud_cancel.js';
import { templates } from './resources/environment_templates.js';
/**
 * Server Configuration
 */
const MAX_CONCURRENCY = parseInt(process.env.CODEX_MAX_CONCURRENCY || '2', 10);
const SERVER_NAME = 'codex-control';
const SERVER_VERSION = '3.0.1';
/**
 * Main Server Class
 */
class CodexControlServer {
    server;
    processManager;
    // Hidden primitive tools
    localRunTool;
    localStatusTool;
    localExecTool;
    localResumeTool;
    localResultsTool;
    localWaitTool;
    localCancelTool;
    cloudSubmitTool;
    cloudStatusTool;
    cloudResultsTool;
    cloudWaitTool;
    cloudCancelTool;
    listEnvironmentsTool;
    githubSetupTool;
    constructor() {
        // Initialize process manager
        this.processManager = new ProcessManager(MAX_CONCURRENCY);
        // Initialize hidden primitive tools
        this.localRunTool = new LocalRunTool(this.processManager);
        this.localStatusTool = new LocalStatusTool(this.processManager);
        this.localExecTool = new LocalExecTool();
        this.localResumeTool = new LocalResumeTool();
        this.localResultsTool = new LocalResultsTool();
        this.localWaitTool = new LocalWaitTool();
        this.localCancelTool = new LocalCancelTool();
        this.cloudSubmitTool = new CloudSubmitTool();
        this.cloudStatusTool = new CloudStatusTool();
        this.cloudResultsTool = new CloudResultsTool();
        this.cloudWaitTool = new CloudWaitTool();
        this.cloudCancelTool = new CloudCancelTool();
        this.listEnvironmentsTool = new ListEnvironmentsTool();
        this.githubSetupTool = new GitHubSetupTool();
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
                    // Hidden primitives (14 tools with _ prefix)
                    LocalRunTool.getSchema(),
                    LocalStatusTool.getSchema(),
                    LocalExecTool.getSchema(),
                    LocalResumeTool.getSchema(),
                    LocalResultsTool.getSchema(),
                    LocalWaitTool.getSchema(),
                    LocalCancelTool.getSchema(),
                    CloudSubmitTool.getSchema(),
                    CloudStatusTool.getSchema(),
                    CloudResultsTool.getSchema(),
                    CloudWaitTool.getSchema(),
                    CloudCancelTool.getSchema(),
                    ListEnvironmentsTool.getSchema(),
                    GitHubSetupTool.getSchema(),
                ],
            };
        });
        // Handle tool calls
        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;
            try {
                switch (name) {
                    // Hidden primitive tools (14 tools with _ prefix)
                    case '_codex_local_run':
                        return await this.localRunTool.execute(args);
                    case '_codex_local_status':
                        return await this.localStatusTool.execute(args);
                    case '_codex_local_exec':
                        return await this.localExecTool.execute(args);
                    case '_codex_local_resume':
                        return await this.localResumeTool.execute(args);
                    case '_codex_local_results':
                        return await this.localResultsTool.execute(args);
                    case '_codex_local_wait':
                        return await this.localWaitTool.execute(args);
                    case '_codex_local_cancel':
                        return await this.localCancelTool.execute(args);
                    case '_codex_cloud_submit':
                        return await this.cloudSubmitTool.execute(args);
                    case '_codex_cloud_status':
                        return await this.cloudStatusTool.execute(args);
                    case '_codex_cloud_results':
                        return await this.cloudResultsTool.execute(args);
                    case '_codex_cloud_wait':
                        return await this.cloudWaitTool.execute(args);
                    case '_codex_cloud_cancel':
                        return await this.cloudCancelTool.execute(args);
                    case '_codex_cloud_list_environments':
                        return await this.listEnvironmentsTool.execute();
                    case '_codex_cloud_github_setup':
                        return await this.githubSetupTool.execute(args);
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
        console.error(`[CodexControl] Server started successfully via npm link ✅`);
        console.error(`[CodexControl] Name: ${SERVER_NAME}`);
        console.error(`[CodexControl] Version: ${SERVER_VERSION}`);
        console.error(`[CodexControl] Max Concurrency: ${MAX_CONCURRENCY}`);
        console.error(`[CodexControl] Tools: 14 hidden primitives (all with _ prefix)`);
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