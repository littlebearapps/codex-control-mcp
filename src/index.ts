#!/usr/bin/env node

/**
 * MCP Delegator
 *
 * Delegate AI agent tasks from Claude Code to Codex, Claude Code (Agent SDK), and more.
 * Provides 13 hidden primitives for Codex operations (local SDK + Cloud) with async execution.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { ProcessManager } from './executor/process_manager.js';
import { LocalRunTool } from './tools/local_run.js';
import { LocalStatusTool } from './tools/local_status.js';
import {
  CloudSubmitTool,
  CloudStatusTool,
  CloudResultsTool,
} from './tools/cloud.js';
import { GitHubSetupTool } from './tools/github_setup.js';
import { LocalExecTool } from './tools/local_exec.js';
import { LocalResumeTool } from './tools/local_resume.js';
import { ListEnvironmentsTool } from './tools/list_environments.js';
import { LocalResultsTool } from './tools/local_results.js';
import { LocalCancelTool } from './tools/local_cancel.js';
import { CloudCancelTool } from './tools/cloud_cancel.js';
import { CleanupRegistryTool } from './tools/cleanup_registry.js';
import { templates } from './resources/environment_templates.js';
import { globalLogger } from './utils/logger.js';
import { globalTaskRegistry } from './state/task_registry.js';
import updateNotifier from 'update-notifier';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Read package.json for update notifier
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkg = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf-8'));

/**
 * Server Configuration
 */
const MAX_CONCURRENCY = parseInt(process.env.CODEX_MAX_CONCURRENCY || '2', 10);
const SERVER_NAME = 'mcp-delegator';
const SERVER_VERSION = '3.4.2';

/**
 * Main Server Class
 */
class MCPDelegatorServer {
  private server: Server;
  private processManager: ProcessManager;
  private cleanupInterval?: NodeJS.Timeout;

  // Hidden primitive tools
  private localRunTool: LocalRunTool;
  private localStatusTool: LocalStatusTool;
  private localExecTool: LocalExecTool;
  private localResumeTool: LocalResumeTool;
  private localResultsTool: LocalResultsTool;
  private localCancelTool: LocalCancelTool;
  private cloudSubmitTool: CloudSubmitTool;
  private cloudStatusTool: CloudStatusTool;
  private cloudResultsTool: CloudResultsTool;
  private cloudCancelTool: CloudCancelTool;
  private listEnvironmentsTool: ListEnvironmentsTool;
  private githubSetupTool: GitHubSetupTool;
  private cleanupRegistryTool: CleanupRegistryTool;

  constructor() {
    // Initialize process manager
    this.processManager = new ProcessManager(MAX_CONCURRENCY);

    // Initialize hidden primitive tools
    this.localRunTool = new LocalRunTool(this.processManager);
    this.localStatusTool = new LocalStatusTool(this.processManager);
    this.localExecTool = new LocalExecTool();
    this.localResumeTool = new LocalResumeTool();
    this.localResultsTool = new LocalResultsTool();
    this.localCancelTool = new LocalCancelTool();
    this.cloudSubmitTool = new CloudSubmitTool();
    this.cloudStatusTool = new CloudStatusTool();
    this.cloudResultsTool = new CloudResultsTool();
    this.cloudCancelTool = new CloudCancelTool();
    this.listEnvironmentsTool = new ListEnvironmentsTool();
    this.githubSetupTool = new GitHubSetupTool();
    this.cleanupRegistryTool = new CleanupRegistryTool();

    // Create MCP server
    this.server = new Server(
      {
        name: SERVER_NAME,
        version: SERVER_VERSION,
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      }
    );

    // Register handlers
    this.setupHandlers();

    // Setup graceful shutdown
    this.setupShutdown();
  }

  /**
   * Setup MCP request handlers
   */
  private setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          // Hidden primitives (13 tools with _ prefix)
          LocalRunTool.getSchema(),
          LocalStatusTool.getSchema(),
          LocalExecTool.getSchema(),
          LocalResumeTool.getSchema(),
          LocalResultsTool.getSchema(),
          LocalCancelTool.getSchema(),
          CloudSubmitTool.getSchema(),
          CloudStatusTool.getSchema(),
          CloudResultsTool.getSchema(),
          CloudCancelTool.getSchema(),
          ListEnvironmentsTool.getSchema(),
          GitHubSetupTool.getSchema(),
          CleanupRegistryTool.getSchema(),
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
      const { name, arguments: args } = request.params;

      // Extract working directory for logging context
      // Note: working_dir is rejected by validation below, only workingDir is accepted
      const workingDir = (args as any)?.workingDir || process.cwd();

      // Log tool start
      globalLogger.toolStart(name, args, workingDir);

      // Strict parameter validation - reject snake_case variants with helpful errors
      const invalidParams: Record<string, string> = {
        working_dir: 'workingDir',
        skip_git_repo_check: 'skipGitRepoCheck',
        env_policy: 'envPolicy',
        env_allow_list: 'envAllowList',
        output_schema: 'outputSchema',
      };

      // Exception: task_id is VALID for results/cancel tools
      const taskIdTools = [
        '_codex_local_results',
        '_codex_local_cancel',
        '_codex_cloud_results',
        '_codex_cloud_cancel',
      ];

      // For non-task-id tools, reject task_id (should use taskId instead)
      if (!taskIdTools.includes(name) && (args as any).task_id !== undefined) {
        invalidParams.task_id = 'taskId';
      }

      // Check for invalid parameters
      for (const [wrong, correct] of Object.entries(invalidParams)) {
        if ((args as any)[wrong] !== undefined) {
          const errorMessage = `❌ Parameter Error\n\nUnknown parameter '${wrong}'.\n\n💡 Did you mean '${correct}'?\n\nCheck .codex-errors.log for details.`;

          globalLogger.error('Invalid parameter used', {
            tool: name,
            wrongParam: wrong,
            correctParam: correct,
            allParams: args ? Object.keys(args) : [],
          }, workingDir);

          return {
            content: [{
              type: 'text' as const,
              text: errorMessage,
            }],
            isError: true,
          };
        }
      }

      try {
        let result;

        switch (name) {
          // Hidden primitive tools (14 tools with _ prefix)
          case '_codex_local_run':
            result = await this.localRunTool.execute(args as any, extra) as any;
            break;

          case '_codex_local_status':
            result = await this.localStatusTool.execute(args as any) as any;
            break;

          case '_codex_local_exec':
            result = await this.localExecTool.execute(args as any, extra) as any;
            break;

          case '_codex_local_resume':
            result = await this.localResumeTool.execute(args as any, extra) as any;
            break;

          case '_codex_local_results':
            result = await this.localResultsTool.execute(args as any) as any;
            break;

          case '_codex_local_cancel':
            result = await this.localCancelTool.execute(args as any) as any;
            break;

          case '_codex_cloud_submit':
            result = await this.cloudSubmitTool.execute(args as any, extra) as any;
            break;

          case '_codex_cloud_status':
            result = await this.cloudStatusTool.execute(args as any) as any;
            break;

          case '_codex_cloud_results':
            result = await this.cloudResultsTool.execute(args as any) as any;
            break;

          case '_codex_cloud_cancel':
            result = await this.cloudCancelTool.execute(args as any) as any;
            break;

          case '_codex_cloud_list_environments':
            result = await this.listEnvironmentsTool.execute() as any;
            break;

          case '_codex_cloud_github_setup':
            result = await this.githubSetupTool.execute(args as any) as any;
            break;

          case '_codex_cleanup_registry':
            result = await this.cleanupRegistryTool.execute(args as any) as any;
            break;

          default:
            globalLogger.error(`Unknown tool: ${name}`, { args }, workingDir);
            return {
              content: [
                {
                  type: 'text' as const,
                  text: `❌ Unknown tool: ${name}\n\nCheck .codex-errors.log for details.`,
                },
              ],
              isError: true,
            };
        }

        // CRITICAL: Ensure result is never undefined
        if (!result || !result.content) {
          globalLogger.error('Tool returned invalid result', {
            tool: name,
            hasResult: !!result,
            hasContent: result?.content !== undefined,
          }, workingDir);

          return {
            content: [
              {
                type: 'text' as const,
                text: `❌ Internal Error: Tool "${name}" returned no result\n\nThis is a bug in the MCP server. Check .codex-errors.log for details.`,
              },
            ],
            isError: true,
          };
        }

        // Log success
        globalLogger.toolSuccess(name, result, workingDir);

        return result;

      } catch (error) {
        // Log failure
        globalLogger.toolFailure(name, error instanceof Error ? error : String(error), args, workingDir);

        return {
          content: [
            {
              type: 'text' as const,
              text: `❌ Tool execution failed: ${error instanceof Error ? error.message : String(error)}\n\nCheck .codex-errors.log for full stack trace.`,
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
  private setupShutdown() {
    const shutdown = async () => {
      console.error('[MCPDelegator] Shutting down...');

      // Clear cleanup interval
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
        console.error('[MCPDelegator] Stopped periodic cleanup scheduler');
      }

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

    console.error(`[MCPDelegator] Server started successfully via npm link ✅`);
    console.error(`[MCPDelegator] Name: ${SERVER_NAME}`);
    console.error(`[MCPDelegator] Version: ${SERVER_VERSION}`);
    console.error(`[MCPDelegator] Max Concurrency: ${MAX_CONCURRENCY}`);
    console.error(`[MCPDelegator] Tools: 14 Codex primitives (all with _ prefix)`);
    console.error(`[MCPDelegator] Resources: ${templates.length} environment templates`);

    // Run cleanup on startup to clear any stuck tasks from previous sessions
    console.error('[MCPDelegator] Running stuck task cleanup on startup...');
    const cleanedOnStartup = globalTaskRegistry.cleanupStuckTasks(3600); // 1 hour default
    if (cleanedOnStartup > 0) {
      console.error(`[MCPDelegator] ⚠️  Cleaned up ${cleanedOnStartup} stuck task(s) from previous session(s)`);
    } else {
      console.error('[MCPDelegator] ✅ No stuck tasks found');
    }

    // Schedule periodic cleanup (every 15 minutes)
    console.error('[MCPDelegator] Scheduling periodic cleanup every 15 minutes...');
    this.cleanupInterval = setInterval(() => {
      const cleaned = globalTaskRegistry.cleanupStuckTasks(3600); // 1 hour default
      if (cleaned > 0) {
        console.error(`[MCPDelegator] ⚠️  Periodic cleanup: marked ${cleaned} stuck task(s) as failed`);
        globalLogger.warn('Periodic cleanup completed', { tasksMarkedFailed: cleaned });
      }
    }, 15 * 60 * 1000); // 15 minutes
  }
}

/**
 * Main entry point
 */
async function main() {
  try {
    // Check for updates (non-blocking, runs in background)
    updateNotifier({
      pkg,
      updateCheckInterval: 1000 * 60 * 60 * 24, // Check once per day
    }).notify({
      isGlobal: true, // Show global install command
    });

    const server = new MCPDelegatorServer();
    await server.start();
  } catch (error) {
    console.error('[MCPDelegator] Fatal error:', error);
    process.exit(1);
  }
}

// Run server
main();
