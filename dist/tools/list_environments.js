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
            const message = count === 0
                ? '⚠️  No environments configured in local config.'
                : count === 1
                    ? '✅ 1 environment configured.'
                    : `✅ ${count} environments configured.`;
            return {
                environments,
                count,
                message,
                configPath: ENVIRONMENTS_CONFIG_PATH,
            };
        }
        catch (error) {
            // Config file doesn't exist
            if (error.code === 'ENOENT') {
                return {
                    environments: {},
                    count: 0,
                    message: `⚠️  Environment config not found. Create ${ENVIRONMENTS_CONFIG_PATH} to define environments.`,
                    configPath: ENVIRONMENTS_CONFIG_PATH,
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