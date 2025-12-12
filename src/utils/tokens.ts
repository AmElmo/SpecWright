import path from 'path';
import fs from 'fs';
import { encode } from 'gpt-3-encoder';
import chalk from 'chalk';
import { SQUAD_DIR } from '../config/constants.js';
import { logger } from './logger.js';

/**
 * Token information for a text with file references
 */
export interface TokenInfo {
    totalTokens: number;
    promptTokens: number;
    fileCount: number;
    files: string[];
}

/**
 * Parse @file references from prompt text
 */
export const parseFileReferences = (text: string): string[] => {
    const fileReferenceRegex = /@([^\s\n]+)/g;
    const matches: string[] = [];
    let match;
    
    while ((match = fileReferenceRegex.exec(text)) !== null) {
        matches.push(match[1]);
    }
    
    return matches;
};

/**
 * Read file content safely
 */
export const readFileContent = (filePath: string): string => {
    try {
        const fullPath = path.resolve(SQUAD_DIR, filePath);
        if (fs.existsSync(fullPath)) {
            return fs.readFileSync(fullPath, 'utf-8');
        } else {
            return `[File not found: ${filePath}]`;
        }
    } catch (error) {
        return `[Error reading file: ${filePath}]`;
    }
};

/**
 * Count tokens in text including referenced files
 */
export const countTokens = (text: string): TokenInfo => {
    try {
        let totalContent = text;
        
        // Parse @file references
        const fileReferences = parseFileReferences(text);
        
        // Read content from each referenced file and add to total
        for (const fileRef of fileReferences) {
            const fileContent = readFileContent(fileRef);
            totalContent += '\n\n' + fileContent;
        }
        
        const tokens = encode(totalContent);
        return {
            totalTokens: tokens.length,
            promptTokens: encode(text).length,
            fileCount: fileReferences.length,
            files: fileReferences
        };
    } catch (error) {
        logger.debug(chalk.yellow("⚠️  Could not count tokens"));
        return {
            totalTokens: 0,
            promptTokens: 0,
            fileCount: 0,
            files: []
        };
    }
};

