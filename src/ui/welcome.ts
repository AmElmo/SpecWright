import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { logger } from '../utils/logger.js';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Get the package version from package.json
 */
export const getVersion = (): string => {
    try {
        const packagePath = path.resolve(__dirname, '../../package.json');
        const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
        return pkg.version || '0.0.0';
    } catch {
        return '0.0.0';
    }
};

/**
 * Display version centered under logo
 */
export const showVersion = (): void => {
    const version = getVersion();
    const termWidth = process.stdout.columns || 120;
    const versionText = `v${version}`;
    const padding = Math.max(0, Math.floor((termWidth - versionText.length) / 2));
    logger.print(' '.repeat(padding) + chalk.dim(versionText));
    logger.print("");
};

/**
 * Display welcome info box with features
 */
export const showWelcomeInfo = (): void => {
    const termWidth = process.stdout.columns || 120;
    const boxWidth = 68;
    const padding = Math.max(0, Math.floor((termWidth - boxWidth) / 2));
    const pad = ' '.repeat(padding);
    
    // Colors matching the logo gradient
    const borderColor = chalk.hex('#4169E1');
    const dimColor = chalk.hex('#6CA6CD');
    const accentColor = chalk.hex('#00D4FF');
    const textColor = chalk.hex('#87CEEB');
    
    // Box characters
    const topLeft = '╭';
    const topRight = '╮';
    const bottomLeft = '╰';
    const bottomRight = '╯';
    const horizontal = '─';
    const vertical = '│';
    
    // Helper to create a line with content
    const line = (content: string, contentWidth: number): string => {
        const innerWidth = boxWidth - 2; // -2 for borders
        const rightPadding = innerWidth - contentWidth;
        return borderColor(vertical) + content + ' '.repeat(Math.max(0, rightPadding)) + borderColor(vertical);
    };
    
    // Empty line
    const emptyLine = (): string => {
        return borderColor(vertical) + ' '.repeat(boxWidth - 2) + borderColor(vertical);
    };
    
    // Top border
    logger.print(pad + borderColor(topLeft + horizontal.repeat(boxWidth - 2) + topRight));
    
    // Main description
    logger.print(pad + emptyLine());
    const desc1 = '  SpecWright uses an AI squad to turn your ideas into';
    logger.print(pad + line(textColor(desc1), desc1.length));
    const desc2 = '  implementation-ready specs before you write code.';
    logger.print(pad + line(textColor(desc2), desc2.length));
    logger.print(pad + emptyLine());
    
    // Features
    const features = [
        { icon: '🧠', label: 'Smart Scoping', desc: 'Determines if work needs a spec or not' },
        { icon: '📋', label: 'AI Squad', desc: 'PM → Designer → Architect → Tech Lead' },
        { icon: '📊', label: 'Issue Breakdown', desc: 'Vertical slices ready for implementation' },
        { icon: '🌐', label: 'Dashboard', desc: 'Track all projects and their status' }
    ];
    
    for (const feature of features) {
        const featureLine = `  ${feature.icon} ${accentColor(feature.label.padEnd(16))} ${dimColor(feature.desc)}`;
        // Calculate actual visible width (accounting for ANSI codes)
        const visibleWidth = 2 + 2 + 16 + 1 + feature.desc.length; // spaces + emoji + label + space + desc
        logger.print(pad + line(featureLine, visibleWidth));
    }
    
    logger.print(pad + emptyLine());
    
    // Bottom border
    logger.print(pad + borderColor(bottomLeft + horizontal.repeat(boxWidth - 2) + bottomRight));
    logger.print("");
};

/**
 * Display folder structure preview
 */
export const showFolderPreview = (): void => {
    const termWidth = process.stdout.columns || 120;
    const boxWidth = 50;
    const padding = Math.max(0, Math.floor((termWidth - boxWidth) / 2));
    const pad = ' '.repeat(padding);
    
    const dimColor = chalk.dim;
    const folderColor = chalk.hex('#FFB732');
    const fileColor = chalk.hex('#87CEEB');
    
    logger.print(pad + dimColor('📂 This will create:'));
    logger.print(pad + folderColor('   └── specwright/'));
    logger.print(pad + fileColor('       ├── templates/') + dimColor('    Agent prompts and templates'));
    logger.print(pad + fileColor('       ├── agents/') + dimColor('       AI agent configurations'));
    logger.print(pad + fileColor('       └── outputs/') + dimColor('      Your specs and projects'));
    logger.print("");
};

/**
 * Display repository info (if detectable)
 */
export const showRepoInfo = (): void => {
    try {
        const cwd = process.cwd();
        const repoName = path.basename(cwd);
        
        const termWidth = process.stdout.columns || 120;
        const infoText = `📍 Repository: ${repoName}`;
        const padding = Math.max(0, Math.floor((termWidth - infoText.length) / 2));
        
        logger.print(' '.repeat(padding) + chalk.dim('📍 Repository: ') + chalk.hex('#00D4FF')(repoName));
        logger.print("");
    } catch {
        // Silently ignore if we can't detect repo
    }
};


