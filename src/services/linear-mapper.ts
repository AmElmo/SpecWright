/**
 * Linear Mapper - Maps Specwright data to Linear API inputs
 *
 * Transforms Specwright projects, issues, and documents to Linear format
 */

import type { ProjectMetadata, IssueMetadata, AcceptanceCriterion } from '../types/index.js';
import type {
  CreateLinearProjectInput,
  CreateLinearIssueInput,
  CreateLinearDocumentInput,
  LinearExternalLink,
} from '../types/linear-sync.js';
import { DEFAULT_PORT } from '../config/constants.js';
import { logger } from '../utils/logger.js';

/**
 * Linear project description max length
 */
const LINEAR_PROJECT_DESCRIPTION_MAX = 255;

/**
 * Truncate text to a max length, adding ellipsis if needed
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Map Specwright project to Linear project input
 *
 * Name format: "001 - Project Title" (project ID + title)
 * Description: Uses project.description for the Linear project summary
 */
export function mapProjectToLinear(
  project: ProjectMetadata,
  teamId: string
): CreateLinearProjectInput {
  logger.debug(`mapProjectToLinear received: id="${project.id}", name="${project.name}", title="${project.title}"`);

  // Build the name: "001 - Project Title"
  const projectId = project.id || '';
  const projectTitle = project.name || project.title || '';

  let name: string;
  if (projectId && projectTitle) {
    name = `${projectId} - ${projectTitle}`;
  } else if (projectTitle) {
    name = projectTitle;
  } else if (projectId) {
    name = `Project ${projectId}`;
  } else {
    name = 'Untitled Project';
  }

  logger.debug(`  Final project name: "${name}"`);

  // Use description for the Linear project summary
  const description = project.description || project.testable_outcome || undefined;

  return {
    name,
    description: description ? truncateText(description, LINEAR_PROJECT_DESCRIPTION_MAX) : undefined,
    teamId,
  };
}

/**
 * Map Specwright issue to Linear issue input
 */
export function mapIssueToLinear(
  issue: IssueMetadata,
  teamId: string,
  projectId?: string
): CreateLinearIssueInput {
  // Build a rich description with all the issue details
  const descriptionParts: string[] = [];

  // Main description
  if (issue.description) {
    descriptionParts.push(issue.description);
  }

  // Key decisions
  if (issue.keyDecisions && issue.keyDecisions.length > 0) {
    descriptionParts.push('\n## Key Decisions\n');
    issue.keyDecisions.forEach(decision => {
      descriptionParts.push(`- ${decision}`);
    });
  }

  // Acceptance criteria
  if (issue.acceptanceCriteria && issue.acceptanceCriteria.length > 0) {
    descriptionParts.push('\n## Acceptance Criteria\n');
    issue.acceptanceCriteria.forEach((criterion: AcceptanceCriterion) => {
      descriptionParts.push(`- [ ] ${criterion.description}`);
    });
  }

  // Technical details
  if (issue.technicalDetails) {
    descriptionParts.push('\n## Technical Details\n');
    descriptionParts.push(issue.technicalDetails);
  }

  // Test strategy
  if (issue.testStrategy) {
    descriptionParts.push('\n## Testing Strategy\n');
    if (issue.testStrategy.automated_tests) {
      descriptionParts.push(`**Automated Tests:** ${issue.testStrategy.automated_tests}`);
    }
    if (issue.testStrategy.manual_verification) {
      descriptionParts.push(`**Manual Verification:** ${issue.testStrategy.manual_verification}`);
    }
  }

  // Human in the loop verification
  if (issue.humanInTheLoop && issue.humanInTheLoop.length > 0) {
    descriptionParts.push('\n## Human Verification Steps\n');
    issue.humanInTheLoop.forEach((step, idx) => {
      descriptionParts.push(`${idx + 1}. ${step}`);
    });
  }

  // Screens affected
  if (issue.screensAffected && issue.screensAffected.length > 0) {
    descriptionParts.push('\n## Screens Affected\n');
    descriptionParts.push(issue.screensAffected.join(', '));
  }

  // Dependencies note
  if (issue.dependencies && issue.dependencies.length > 0) {
    descriptionParts.push('\n## Dependencies\n');
    descriptionParts.push(`Depends on: ${issue.dependencies.join(', ')}`);
  }

  return {
    title: issue.title,
    description: descriptionParts.join('\n'),
    teamId,
    projectId,
    priority: mapPriorityFromEstimate(issue.estimatedHours),
    estimate: mapEstimateToPoints(issue.estimatedHours),
  };
}

/**
 * Map estimated hours to Linear priority
 * Higher hours = potentially higher priority (more important work)
 * But this is a rough heuristic - can be adjusted
 *
 * Linear priorities: 0 = No priority, 1 = Urgent, 2 = High, 3 = Normal, 4 = Low
 */
export function mapPriorityFromEstimate(estimatedHours: number): number {
  // Default to Normal priority (3)
  // We don't have priority in Specwright issues, so use a default
  return 3;
}

/**
 * Map estimated hours to Linear estimate points
 * Using fibonacci-like scale common in Linear
 */
export function mapEstimateToPoints(estimatedHours: number): number {
  if (estimatedHours <= 1) return 1;
  if (estimatedHours <= 2) return 2;
  if (estimatedHours <= 4) return 3;
  if (estimatedHours <= 8) return 5;
  if (estimatedHours <= 16) return 8;
  if (estimatedHours <= 32) return 13;
  return 21;
}

/**
 * Map Specwright issue status to Linear status type
 */
export function mapStatusToLinear(status: IssueMetadata['status']): string {
  switch (status) {
    case 'pending':
      return 'backlog';
    case 'in-review':
      return 'started';
    case 'approved':
      return 'completed';
    default:
      return 'backlog';
  }
}

/**
 * Create a Linear document input from markdown content
 */
export function createDocumentInput(
  title: string,
  content: string,
  projectId: string
): CreateLinearDocumentInput {
  return {
    title,
    content,
    projectId,
  };
}

/**
 * Generate external links for Specwright resources
 * URL format: /project/:id/docs/:docType
 */
export function generateExternalLinks(projectId: string): LinearExternalLink[] {
  const baseUrl = `http://localhost:${DEFAULT_PORT}`;

  return [
    {
      title: '📱 Screen Designs (Specwright)',
      url: `${baseUrl}/project/${projectId}/docs/screens`,
    },
    {
      title: '🔧 Technology Choices (Specwright)',
      url: `${baseUrl}/project/${projectId}/docs/tech-choices`,
    },
    {
      title: '✅ Acceptance Criteria (Specwright)',
      url: `${baseUrl}/project/${projectId}/docs/acceptance-criteria`,
    },
    {
      title: '📋 Full Project Overview (Specwright)',
      url: `${baseUrl}/project/${projectId}`,
    },
  ];
}

/**
 * Get the Specwright localhost URL for a resource
 */
export function getSpecwrightLink(projectId: string, resource: string): string {
  return `http://localhost:${DEFAULT_PORT}/project/${projectId}/${resource}`;
}

/**
 * Parse issue dependencies to create Linear relations
 * Returns array of {issueId, dependsOn} for issues that have dependencies
 */
export function parseIssueDependencies(
  issues: IssueMetadata[]
): Array<{ issueId: string; dependsOn: string[] }> {
  return issues
    .filter(issue => issue.dependencies && issue.dependencies.length > 0)
    .map(issue => ({
      issueId: issue.issueId,
      dependsOn: issue.dependencies,
    }));
}
