/**
 * Environment templates for Codex Cloud GitHub integration
 *
 * These templates provide pre-configured setup scripts for different
 * technology stacks with 4-level fallback error handling.
 */
import { EnvironmentTemplate } from '../types/template_types.js';
/**
 * All environment templates
 */
export declare const templates: EnvironmentTemplate[];
/**
 * Get template by name
 */
export declare function getTemplate(name: string): EnvironmentTemplate | undefined;
/**
 * Get templates by repo type
 */
export declare function getTemplatesByRepoType(repoType: string): EnvironmentTemplate[];
/**
 * List all GitHub-integrated templates
 */
export declare function getGitHubTemplates(): EnvironmentTemplate[];
//# sourceMappingURL=environment_templates.d.ts.map