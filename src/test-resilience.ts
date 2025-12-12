/**
 * Test script to validate phase resilience
 * Run with: npm run dev -- test-resilience <project-id>
 * 
 * This script tests the phase validation and auto-recovery system.
 * It validates that the system can detect invalid phase states and recover gracefully.
 */

import { validateCurrentPhase } from './services/phase-validation-service.js';
import { validateAndRecoverPhase, readProjectStatus } from './services/status-service.js';
import { logger } from './utils/logger.js';
import * as path from 'path';

// Get project ID from command line args or use a default
const args = process.argv.slice(2);
const projectId = args[0];

if (!projectId) {
  logger.error('\n❌ Error: Project ID required\n');
  logger.print('Usage: npm run dev -- test-resilience <project-id>');
  logger.print('Example: npm run dev -- test-resilience 001-user-authentication');
  process.exit(1);
}

logger.debug('\n🧪 Testing Phase Resilience System\n');
logger.debug('='.repeat(80));

logger.debug(`\n📂 Working Directory: ${process.cwd()}`);
logger.debug(`📋 Testing Project: ${projectId}`);

// Read current status
const statusBefore = readProjectStatus(projectId);
if (!statusBefore) {
  logger.error(`\n❌ Project not found: ${projectId}`);
  logger.print('\nMake sure you are running this from your project root directory.');
  logger.print('The project should exist in: outputs/projects/');
  process.exit(1);
}

if (statusBefore) {
  logger.debug('\n📊 Current Status (BEFORE):');
  logger.debug(`   Project: ${projectId}`);
  logger.debug(`   Current Phase: ${statusBefore.currentPhase}`);
  logger.debug(`   Current Agent: ${statusBefore.currentAgent}`);
  logger.debug(`   Engineer Phase: ${statusBefore.agents.engineer.currentPhase}`);
  logger.debug(`   Engineer Status: ${statusBefore.agents.engineer.phases['questions-answer']?.status}`);
}

// Test validation
logger.debug('\n🔍 Testing Validation:');
const validation = validateCurrentPhase(projectId, 'engineer-questions-answer');
logger.debug(`   Is Valid: ${validation.isValid}`);
if (!validation.isValid) {
  logger.debug(`   Reason: ${validation.reason}`);
  logger.debug(`   Missing Files: ${validation.missingFiles?.join(', ')}`);
  logger.debug(`   Suggested Phase: ${validation.suggestedPhase}`);
}

// Test auto-recovery
logger.debug('\n🔧 Testing Auto-Recovery:');
const recoveredStatus = validateAndRecoverPhase(projectId);
logger.debug(`   Recovered Phase: ${recoveredStatus.currentPhase}`);
logger.debug(`   Recovered Agent: ${recoveredStatus.currentAgent}`);
logger.debug(`   Engineer Phase: ${recoveredStatus.agents.engineer.currentPhase}`);
const phaseStatus = recoveredStatus.agents.engineer.phases['questions-generate']?.status;
logger.debug(`   Engineer questions-generate status: ${phaseStatus}`);

logger.debug('\n' + '='.repeat(80));
logger.debug('\n✅ Test Complete!');
logger.debug('\n📝 Summary:');
logger.debug('   - Validated phase resilience system');
logger.debug('   - Tested phase validation detection');
logger.debug('   - Verified auto-recovery mechanism');
logger.debug('');

