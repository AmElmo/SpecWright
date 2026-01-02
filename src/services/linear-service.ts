/**
 * Linear Service - SDK wrapper for Linear API operations
 *
 * Provides methods for creating projects, issues, and documents in Linear
 */

import { LinearClient, IssueRelationType } from '@linear/sdk';
import { logger } from '../utils/logger.js';
import type {
  LinearTeamInfo,
  CreateLinearProjectInput,
  CreateLinearIssueInput,
  CreateLinearDocumentInput,
  LinearExternalLink,
} from '../types/linear-sync.js';

/**
 * Linear Service class for API operations
 */
export class LinearService {
  private client: LinearClient;

  constructor(apiKey: string) {
    this.client = new LinearClient({ apiKey });
  }

  /**
   * Validate the API key by making a test request
   */
  async validateApiKey(): Promise<boolean> {
    try {
      const viewer = await this.client.viewer;
      return !!viewer.id;
    } catch (error) {
      logger.error('Invalid Linear API key:', error);
      return false;
    }
  }

  /**
   * Get all teams accessible with this API key
   */
  async getTeams(): Promise<LinearTeamInfo[]> {
    try {
      const teams = await this.client.teams();
      return teams.nodes.map(team => ({
        id: team.id,
        name: team.name,
        key: team.key,
        icon: team.icon || undefined,
      }));
    } catch (error) {
      logger.error('Failed to fetch Linear teams:', error);
      throw error;
    }
  }

  /**
   * Create a new project in Linear
   */
  async createProject(input: CreateLinearProjectInput): Promise<{ id: string; url: string }> {
    try {
      const result = await this.client.createProject({
        name: input.name,
        description: input.description,
        teamIds: [input.teamId],
        leadId: input.leadId,
      });

      if (!result.success || !result.project) {
        throw new Error('Failed to create Linear project');
      }

      const project = await result.project;
      return {
        id: project.id,
        url: project.url,
      };
    } catch (error) {
      logger.error('Failed to create Linear project:', error);
      throw error;
    }
  }

  /**
   * Create a document attached to a project
   */
  async createDocument(input: CreateLinearDocumentInput): Promise<{ id: string }> {
    try {
      const result = await this.client.createDocument({
        title: input.title,
        content: input.content,
        projectId: input.projectId,
      });

      if (!result.success || !result.document) {
        throw new Error('Failed to create Linear document');
      }

      const document = await result.document;
      return { id: document.id };
    } catch (error) {
      logger.error('Failed to create Linear document:', error);
      throw error;
    }
  }

  /**
   * Create an issue in Linear
   */
  async createIssue(input: CreateLinearIssueInput): Promise<{ id: string; identifier: string; url: string }> {
    try {
      const result = await this.client.createIssue({
        title: input.title,
        description: input.description,
        teamId: input.teamId,
        projectId: input.projectId,
        priority: input.priority,
        estimate: input.estimate,
        parentId: input.parentId,
      });

      if (!result.success || !result.issue) {
        throw new Error('Failed to create Linear issue');
      }

      const issue = await result.issue;
      return {
        id: issue.id,
        identifier: issue.identifier,
        url: issue.url,
      };
    } catch (error) {
      logger.error('Failed to create Linear issue:', error);
      throw error;
    }
  }

  /**
   * Create multiple issues in Linear
   * Returns a map of specwright issue IDs to Linear issue IDs
   */
  async createIssues(
    issues: Array<{ specwrightId: string; input: CreateLinearIssueInput }>
  ): Promise<Map<string, { linearId: string; identifier: string; url: string }>> {
    const results = new Map<string, { linearId: string; identifier: string; url: string }>();

    for (const { specwrightId, input } of issues) {
      try {
        const result = await this.createIssue(input);
        results.set(specwrightId, {
          linearId: result.id,
          identifier: result.identifier,
          url: result.url,
        });
      } catch (error) {
        logger.error(`Failed to create issue ${specwrightId}:`, error);
        // Continue with other issues
      }
    }

    return results;
  }

  /**
   * Add an external link to a project
   * Linear projects have a "resources" section for external links
   */
  async addProjectLink(projectId: string, link: LinearExternalLink): Promise<void> {
    try {
      // Get the project first to access its links
      const project = await this.client.project(projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      // Linear SDK doesn't have a direct method for project links
      // We'll add the link to the project description as a workaround
      // Or use the attachment API if available
      const existingDescription = project.description || '';
      const linkSection = `\n\n---\n**Resources:**\n- [${link.title}](${link.url})`;

      // Only add if not already present
      if (!existingDescription.includes(link.url)) {
        await this.client.updateProject(projectId, {
          description: existingDescription + linkSection,
        });
      }
    } catch (error) {
      logger.error('Failed to add project link:', error);
      throw error;
    }
  }

  /**
   * Add multiple external links to a project
   * Note: Linear has a 255 character limit on project descriptions,
   * so we skip adding links if they would exceed the limit.
   */
  async addProjectLinks(projectId: string, links: LinearExternalLink[]): Promise<void> {
    try {
      const project = await this.client.project(projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      const existingDescription = project.description || '';

      // Build links section
      const linksMarkdown = links
        .filter(link => !existingDescription.includes(link.url))
        .map(link => `- [${link.title}](${link.url})`)
        .join('\n');

      if (linksMarkdown) {
        const linkSection = `\n\n---\n**Specwright Resources:**\n${linksMarkdown}`;
        const newDescription = existingDescription + linkSection;

        // Skip if the new description would exceed Linear's 255 character limit
        if (newDescription.length > 255) {
          logger.debug('Skipping project links: would exceed 255 character description limit');
          return;
        }

        await this.client.updateProject(projectId, {
          description: newDescription,
        });
      }
    } catch (error) {
      logger.error('Failed to add project links:', error);
      throw error;
    }
  }

  /**
   * Set issue dependencies (blocks relationship)
   * @param issueId The issue that blocks others
   * @param blockedIssueIds Issues that are blocked by this issue
   */
  async setIssueDependencies(
    issueIdMap: Map<string, string>,
    dependencies: Array<{ issueId: string; dependsOn: string[] }>
  ): Promise<void> {
    for (const { issueId, dependsOn } of dependencies) {
      const linearIssueId = issueIdMap.get(issueId);
      if (!linearIssueId) continue;

      for (const depId of dependsOn) {
        const linearDepId = issueIdMap.get(depId);
        if (!linearDepId) continue;

        try {
          // Create a "blocked by" relation
          await this.client.createIssueRelation({
            issueId: linearIssueId,
            relatedIssueId: linearDepId,
            type: IssueRelationType.Blocks,
          });
        } catch (error) {
          logger.error(`Failed to set dependency ${depId} -> ${issueId}:`, error);
          // Continue with other dependencies
        }
      }
    }
  }

  /**
   * Check if a project exists and is active in Linear
   * Returns true if the project exists and is not canceled/archived, false otherwise
   */
  async projectExists(projectId: string): Promise<boolean> {
    try {
      const project = await this.client.project(projectId);
      if (!project) {
        return false;
      }

      // Check the project state - Linear projects can be in various states
      // state is a string like "backlog", "planned", "started", "paused", "completed", "canceled"
      const state = project.state?.toLowerCase() || '';
      if (state === 'canceled') {
        logger.debug(`Linear project ${projectId} is canceled`);
        return false;
      }

      // Also check if project is archived
      if (project.archivedAt) {
        logger.debug(`Linear project ${projectId} is archived`);
        return false;
      }

      return true;
    } catch (error) {
      // Project not found or error - treat as not existing
      logger.debug(`Linear project ${projectId} not found or error:`, error);
      return false;
    }
  }

  /**
   * Get available workflow states for a team
   * Used to map Specwright statuses to Linear statuses
   */
  async getTeamWorkflowStates(teamId: string): Promise<Array<{ id: string; name: string; type: string }>> {
    try {
      const team = await this.client.team(teamId);
      if (!team) {
        throw new Error('Team not found');
      }

      const states = await team.states();
      return states.nodes.map(state => ({
        id: state.id,
        name: state.name,
        type: state.type,
      }));
    } catch (error) {
      logger.error('Failed to fetch workflow states:', error);
      throw error;
    }
  }
}

/**
 * Create a LinearService instance from settings
 */
export function createLinearService(apiKey: string): LinearService {
  return new LinearService(apiKey);
}
