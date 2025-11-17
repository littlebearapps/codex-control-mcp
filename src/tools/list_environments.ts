import { readFile } from 'fs/promises';
import { homedir } from 'os';
import { join } from 'path';

const ENVIRONMENTS_CONFIG_PATH = join(homedir(), '.config', 'mcp-delegator', 'environments.json');

export interface CodexEnvironment {
  name: string;
  repoUrl: string;
  stack: string;
  description?: string;
}

export interface ListEnvironmentsResult {
  content: Array<{
    type: 'text';
    text: string;
  }>;
}

export class ListEnvironmentsTool {
  static getSchema() {
    return {
      name: '_codex_cloud_list_environments',
      description: 'List your Codex Cloud environments - like checking which servers you have access to. Reads from local config file (~/.config/mcp-delegator/environments.json) since there\'s no API for environment discovery. Use this when: you need an environment ID for _codex_cloud_submit, want to see which repos are configured, or are setting up a new project. Returns: environment IDs, names, repository URLs, tech stacks. Perfect for: "which environment should I use?", documentation of your setup, or finding that environment ID you forgot. This is local-only data you maintain manually. Avoid if: you just want to submit a task and already know the environment ID.',
      inputSchema: {
        type: 'object',
        properties: {},
        required: [],
      },
    };
  }

  async execute(): Promise<ListEnvironmentsResult> {
    try {
      // Load environments config
      const data = await readFile(ENVIRONMENTS_CONFIG_PATH, 'utf-8');
      const environments: Record<string, CodexEnvironment> = JSON.parse(data);

      const count = Object.keys(environments).length;

      if (count === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `⚠️  No environments configured in local config.\n\n**Config Path**: ${ENVIRONMENTS_CONFIG_PATH}\n\n**Setup**: Create this file with your Codex Cloud environments. Use \`codex_cloud_github_setup\` for examples.`,
            },
          ],
        };
      }

      // Format environment list
      let message = `## Codex Cloud Environments\n\n`;
      message += `✅ **${count}** environment${count === 1 ? '' : 's'} configured\n\n`;
      message += `**Config**: ${ENVIRONMENTS_CONFIG_PATH}\n\n`;
      message += `### Environments:\n\n`;

      for (const [envId, env] of Object.entries(environments)) {
        message += `**${envId}**\n`;
        message += `- Name: ${env.name}\n`;
        message += `- Stack: ${env.stack}\n`;
        message += `- Repo: ${env.repoUrl}\n`;
        if (env.description) {
          message += `- Description: ${env.description}\n`;
        }
        message += `\n`;
      }

      message += `\n💡 Use these environment IDs with \`codex_cloud_submit\` to submit background tasks.`;

      return {
        content: [{ type: 'text', text: message }],
      };
    } catch (error) {
      // Config file doesn't exist
      if ((error as any).code === 'ENOENT') {
        return {
          content: [
            {
              type: 'text',
              text: `⚠️  Environment config not found.\n\n**Expected Path**: ${ENVIRONMENTS_CONFIG_PATH}\n\n**Setup**: Create this file to define Codex Cloud environments. Use \`codex_cloud_github_setup\` to generate setup instructions.\n\n**Example**:\n\`\`\`json\n${ListEnvironmentsTool.getExampleConfig()}\n\`\`\``,
            },
          ],
        };
      }

      throw error;
    }
  }

  /**
   * Helper method to generate example config
   */
  static getExampleConfig(): string {
    return JSON.stringify(
      {
        'seo-ads-expert-online': {
          name: 'SEO Ads Expert',
          repoUrl: 'https://github.com/littlebearapps/seo-ads-expert',
          stack: 'node',
          description: 'SEO and Google Ads automation tool',
        },
        'illustrations-training': {
          name: 'Illustrations Training',
          repoUrl: 'https://github.com/littlebearapps/illustrations',
          stack: 'python',
          description: 'Kohya LoRA training with Runpod integration',
        },
      },
      null,
      2
    );
  }
}
