import { readFile } from 'fs/promises';
import { homedir } from 'os';
import { join } from 'path';
const ENVIRONMENTS_CONFIG_PATH = join(homedir(), '.config', 'codex-control', 'environments.json');
export class ListEnvironmentsTool {
    static getSchema() {
        return {
            name: 'codex_list_environments',
            description: 'List available Codex Cloud environments from local configuration. Reads from ~/.config/codex-control/environments.json (user-maintained). Returns environment IDs, names, repo URLs, and tech stacks. Note: No programmatic API exists for environment discovery - this uses local config.',
            inputSchema: {
                type: 'object',
                properties: {},
                required: [],
            },
        };
    }
    async execute() {
        try {
            // Load environments config
            const data = await readFile(ENVIRONMENTS_CONFIG_PATH, 'utf-8');
            const environments = JSON.parse(data);
            const count = Object.keys(environments).length;
            if (count === 0) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: `⚠️  No environments configured in local config.\n\n**Config Path**: ${ENVIRONMENTS_CONFIG_PATH}\n\n**Setup**: Create this file with your Codex Cloud environments. Use \`codex_github_setup_guide\` for examples.`,
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
        }
        catch (error) {
            // Config file doesn't exist
            if (error.code === 'ENOENT') {
                return {
                    content: [
                        {
                            type: 'text',
                            text: `⚠️  Environment config not found.\n\n**Expected Path**: ${ENVIRONMENTS_CONFIG_PATH}\n\n**Setup**: Create this file to define Codex Cloud environments. Use \`codex_github_setup_guide\` to generate setup instructions.\n\n**Example**:\n\`\`\`json\n${ListEnvironmentsTool.getExampleConfig()}\n\`\`\``,
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
    static getExampleConfig() {
        return JSON.stringify({
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
        }, null, 2);
    }
}
//# sourceMappingURL=list_environments.js.map