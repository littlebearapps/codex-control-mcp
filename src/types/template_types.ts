/**
 * Environment template type definitions for Codex Cloud GitHub integration
 */

/**
 * Environment template for Codex Cloud setup
 *
 * Templates provide pre-configured setup scripts for different technology stacks
 * with GitHub integration for autonomous PR workflows.
 */
export interface EnvironmentTemplate {
  /** Unique identifier for the template (e.g., "github-node-typescript") */
  name: string;

  /** Human-readable description of what this template provides */
  description: string;

  /** Technology stacks this template supports (e.g., ["node", "typescript"]) */
  repoTypes: string[];

  /** Bash script to run on first container startup (installs tools, configures auth) */
  setupScript: string;

  /** Bash script to run on cached container startup (updates dependencies) */
  maintenanceScript: string;

  /** List of required Codex Cloud secrets (e.g., ["GITHUB_TOKEN"]) */
  requiredSecrets: string[];

  /** Default environment variables for the container */
  environmentVariables: Record<string, string>;

  /** Markdown instructions for setting up GitHub integration */
  instructions: string;
}

/**
 * Validation result for template quality checks
 */
export interface TemplateValidationResult {
  /** Whether template passes all validation checks */
  valid: boolean;

  /** Template name being validated */
  templateName: string;

  /** List of validation errors (empty if valid) */
  errors: string[];

  /** List of validation warnings (non-blocking) */
  warnings: string[];
}

/**
 * Template categories for organization
 */
export enum TemplateCategory {
  /** GitHub-integrated templates with PR workflow support */
  GITHUB = "github",

  /** Basic Codex Cloud templates without GitHub integration */
  BASIC = "basic",

  /** CI/CD pipeline templates */
  CICD = "cicd",

  /** Testing framework templates */
  TESTING = "testing",
}

/**
 * Template metadata for discovery and filtering
 */
export interface TemplateMetadata {
  /** Template unique identifier */
  name: string;

  /** Display name for UI */
  displayName: string;

  /** Category classification */
  category: TemplateCategory;

  /** Technology tags for filtering */
  tags: string[];

  /** Popularity score (0-100) */
  popularity: number;

  /** Last updated timestamp */
  lastUpdated: string;
}
