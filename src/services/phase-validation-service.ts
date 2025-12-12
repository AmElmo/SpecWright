/**
 * Phase Validation Service - Validates that required files exist and are properly formed for each phase
 * 
 * This service ensures resilience by checking that when a phase is active,
 * all required files actually exist and contain valid data.
 */

import fs from 'fs';
import path from 'path';
import { OUTPUT_DIR } from '../config/constants.js';
import type { AgentType } from '../types/project-status.js';
import { logger } from '../utils/logger.js';
import {
    getPMQuestionsPath,
    getUXQuestionsPath,
    getEngineerQuestionsPath,
    getPRDPath,
    getDesignBriefPath,
    getWireframesPath,
    getTechnicalSpecPath
} from '../utils/project-paths.js';

interface ValidationResult {
  isValid: boolean;
  missingFiles?: string[];
  invalidFiles?: string[];
  suggestedPhase?: string;
  reason?: string;
}

/**
 * Validate that a JSON file exists and has the expected structure
 */
function validateQuestionsFile(filePath: string): boolean {
  if (!fs.existsSync(filePath)) {
    return false;
  }
  
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    
    // Check if it has the required structure
    if (!data.questions || !Array.isArray(data.questions)) {
      return false;
    }
    
    // Check if questions array is empty or has placeholder data
    if (data.questions.length === 0) {
      return false;
    }
    
    // Check if questions have proper structure with non-empty question text
    for (const q of data.questions) {
      if (!q.question || typeof q.question !== 'string' || q.question.trim().length === 0) {
        return false;
      }
      // Check if it's a placeholder question
      if (q.question.includes('Waiting for') || q.question.includes('placeholder')) {
        return false;
      }
    }
    
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Validate that a markdown file exists and has real content
 */
function validateMarkdownFile(filePath: string, minLength = 500): boolean {
  if (!fs.existsSync(filePath)) {
    return false;
  }
  
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // Check minimum length
    if (content.trim().length < minLength) {
      return false;
    }
    
    // Check for placeholder text
    const placeholderIndicators = [
      'TODO',
      'PLACEHOLDER',
      'Coming soon',
      'TBD',
      'To be determined',
      'Fill this in'
    ];
    
    const upperContent = content.toUpperCase();
    for (const indicator of placeholderIndicators) {
      if (upperContent.includes(indicator.toUpperCase())) {
        return false;
      }
    }
    
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Validate that screen inventory JSON exists and has real data
 */
function validateScreenInventoryFile(filePath: string): boolean {
  if (!fs.existsSync(filePath)) {
    return false;
  }
  
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    
    // Check if it has screens array
    if (!data.screens || !Array.isArray(data.screens)) {
      return false;
    }
    
    // Must have at least one screen
    if (data.screens.length === 0) {
      return false;
    }
    
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Validate PM questions-answer phase
 * Requires: pm_questions.json with valid questions
 */
export function validatePMQuestionsAnswer(projectId: string): ValidationResult {
  const questionsFile = getPMQuestionsPath(projectId);
  
  if (!validateQuestionsFile(questionsFile)) {
    return {
      isValid: false,
      missingFiles: [questionsFile],
      suggestedPhase: 'pm-questions-generate',
      reason: 'PM questions file is missing or invalid'
    };
  }
  
  return { isValid: true };
}

/**
 * Validate PM PRD review phase
 * Requires: prd.md with real content
 */
export function validatePMPRDReview(projectId: string): ValidationResult {
  const prdFile = getPRDPath(projectId);
  
  if (!validateMarkdownFile(prdFile, 500)) {
    return {
      isValid: false,
      missingFiles: [prdFile],
      suggestedPhase: 'pm-prd-generate',
      reason: 'PRD file is missing or incomplete'
    };
  }
  
  return { isValid: true };
}

/**
 * Validate UX questions-answer phase
 * Requires: ux_questions.json with valid questions
 */
export function validateUXQuestionsAnswer(projectId: string): ValidationResult {
  const questionsFile = getUXQuestionsPath(projectId);
  
  if (!validateQuestionsFile(questionsFile)) {
    return {
      isValid: false,
      missingFiles: [questionsFile],
      suggestedPhase: 'ux-questions-generate',
      reason: 'UX questions file is missing or invalid'
    };
  }
  
  return { isValid: true };
}

/**
 * Validate UX design brief review phase
 * Requires: design_brief.md and ux_designer_wireframes.md with real content
 */
export function validateUXDesignBriefReview(projectId: string): ValidationResult {
  const designBriefFile = getDesignBriefPath(projectId);
  const wireframesFile = getWireframesPath(projectId);
  
  if (!validateMarkdownFile(designBriefFile, 300)) {
    return {
      isValid: false,
      missingFiles: [designBriefFile],
      suggestedPhase: 'ux-design-brief-generate',
      reason: 'Design brief file is missing or incomplete'
    };
  }
  
  if (!validateMarkdownFile(wireframesFile, 500)) {
    return {
      isValid: false,
      missingFiles: [wireframesFile],
      suggestedPhase: 'ux-design-brief-generate',
      reason: 'Wireframes file is missing or incomplete'
    };
  }
  
  return { isValid: true };
}

/**
 * Validate Engineer questions-answer phase
 * Requires: engineer_questions.json with valid questions
 */
export function validateEngineerQuestionsAnswer(projectId: string): ValidationResult {
  const questionsFile = getEngineerQuestionsPath(projectId);
  
  if (!validateQuestionsFile(questionsFile)) {
    return {
      isValid: false,
      missingFiles: [questionsFile],
      suggestedPhase: 'engineer-questions-generate',
      reason: 'Engineer questions file is missing or invalid'
    };
  }
  
  return { isValid: true };
}

/**
 * Validate Engineer spec review phase
 * Requires: technical_specification.md with real content
 */
export function validateEngineerSpecReview(projectId: string): ValidationResult {
  const specFile = getTechnicalSpecPath(projectId);
  
  if (!validateMarkdownFile(specFile, 500)) {
    return {
      isValid: false,
      missingFiles: [specFile],
      suggestedPhase: 'engineer-spec-generate',
      reason: 'Technical specification file is missing or incomplete'
    };
  }
  
  return { isValid: true };
}

/**
 * Main validation function - validates current phase has required files
 */
export function validateCurrentPhase(projectId: string, currentPhase: string): ValidationResult {
  logger.debug(`\n🔍 [Validation] Checking phase: ${currentPhase} for project ${projectId}`);
  
  // Map phases to their validation functions
  const validators: { [key: string]: (projectId: string) => ValidationResult } = {
    'pm-questions-answer': validatePMQuestionsAnswer,
    'pm-prd-review': validatePMPRDReview,
    'ux-questions-answer': validateUXQuestionsAnswer,
    'ux-design-brief-review': validateUXDesignBriefReview,
    'engineer-questions-answer': validateEngineerQuestionsAnswer,
    'engineer-spec-review': validateEngineerSpecReview
  };
  
  const validator = validators[currentPhase];
  
  if (!validator) {
    // Phase doesn't need validation (e.g., generate phases)
    logger.debug(`✓ [Validation] No validation needed for phase: ${currentPhase}`);
    return { isValid: true };
  }
  
  const result = validator(projectId);
  
  if (!result.isValid) {
    logger.debug(`⚠️  [Validation] Phase validation failed: ${result.reason}`);
    logger.debug(`   Missing/invalid files: ${result.missingFiles?.join(', ')}`);
    logger.debug(`   Suggested phase: ${result.suggestedPhase}`);
  } else {
    logger.debug(`✓ [Validation] Phase validation passed`);
  }
  
  return result;
}

