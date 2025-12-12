import chalk from 'chalk';
import stringWidth from 'string-width';
import { logger } from '../utils/logger.js';

/**
 * Helper function to center text based on terminal width
 */
const centerText = (text: string, visualWidth: number | null = null): string => {
    const termWidth = process.stdout.columns || 120;
    const textWidth = visualWidth || text.length;
    const padding = Math.max(0, Math.floor((termWidth - textWidth) / 2));
    return ' '.repeat(padding);
};

/**
 * Display SpecWright logo with sleek blue gradient
 */
export const showLogo = (): void => {
    logger.print("");
    
    // Measure actual logo width by combining both parts of first line
    const logoLine1Part1 = "███████╗ ██████╗  ███████╗  ██████╗";
    const logoLine1Part2 = "  ██╗    ██╗ ██████╗  ██╗  ██████╗  ██╗  ██╗ ████████╗";
    const logoWidth = logoLine1Part1.length + logoLine1Part2.length;
    const pad = centerText('', logoWidth);
    
    logger.print(pad + chalk.hex('#00D4FF')(logoLine1Part1) + chalk.hex('#00BFFF')(logoLine1Part2));
    logger.print(pad + chalk.hex('#00BFFF')("██╔════╝ ██╔══██╗ ██╔════╝ ██╔════╝") + chalk.hex('#1E90FF')("  ██║    ██║ ██╔══██╗ ██║ ██╔════╝  ██║  ██║ ╚══██╔══╝"));
    logger.print(pad + chalk.hex('#1E90FF')("███████╗ ██████╔╝ █████╗   ██║     ") + chalk.hex('#4169E1')("  ██║ █╗ ██║ ██████╔╝ ██║ ██║  ███╗ ███████║    ██║   "));
    logger.print(pad + chalk.hex('#4169E1')("╚════██║ ██╔═══╝  ██╔══╝   ██║     ") + chalk.hex('#5B9BDF')("  ██║███╗██║ ██╔══██╗ ██║ ██║   ██║ ██╔══██║    ██║   "));
    logger.print(pad + chalk.hex('#5B9BDF')("███████║ ██║      ███████╗ ╚██████╗") + chalk.hex('#6CA6CD')("  ╚███╔███╔╝ ██║  ██║ ██║ ╚██████╔╝ ██║  ██║    ██║   "));
    logger.print(pad + chalk.hex('#6CA6CD')("╚══════╝ ╚═╝      ╚══════╝  ╚═════╝") + chalk.hex('#87CEEB')("   ╚══╝╚══╝  ╚═╝  ╚═╝ ╚═╝  ╚═════╝  ╚═╝  ╚═╝    ╚═╝   "));
    logger.print("");
    
    // Center subtitle text within the logo's width
    const subtitle1Full = "⚡ AI-Powered Specification Engine ⚡";
    const subtitle1Width = stringWidth(subtitle1Full);
    const subtitle1Pad = pad + ' '.repeat(Math.floor((logoWidth - subtitle1Width) / 2));
    
    logger.print(subtitle1Pad + chalk.hex('#00D4FF')("⚡ ") + chalk.hex('#1E90FF')("AI-Powered Specification Engine") + chalk.hex('#00D4FF')(" ⚡"));
    logger.print("");
};

/**
 * Show "Squad Ready" visual with project info
 */
export const showSquadReady = (projectName: string, projectId: string): void => {
    logger.print("");
    logger.print("");
    
    const pad = centerText('', 60);
    
    logger.print(pad + chalk.hex('#FF6B00')("███████╗  ██████╗  ██╗   ██╗  █████╗  ████████╗"));
    logger.print(pad + chalk.hex('#FF8C00')("██╔════╝ ██╔═══██╗ ██║   ██║ ██╔══██╗ ██╔═══██║"));
    logger.print(pad + chalk.hex('#FFA500')("███████╗ ██║   ██║ ██║   ██║ ███████║ ██║   ██║"));
    logger.print(pad + chalk.hex('#FFB732')("╚════██║ ██║▄▄ ██║ ██║   ██║ ██╔══██║ ██║   ██║"));
    logger.print(pad + chalk.hex('#FFC966')("███████║ ╚██████╔╝ ╚██████╔╝ ██║  ██║ ████████║"));
    logger.print(pad + chalk.hex('#FFD280')("╚══════╝  ╚══▀▀═╝   ╚═════╝  ╚═╝  ╚═╝ ╚═══════╝"));
    logger.print("");
    logger.print(pad + chalk.hex('#FF8C00')("          ██████╗  ███████╗  █████╗  ████████╗ ██╗   ██╗ ██╗"));
    logger.print(pad + chalk.hex('#FFA500')("          ██╔══██╗ ██╔════╝ ██╔══██╗ ██╔═══██║ ╚██╗ ██╔╝ ██║"));
    logger.print(pad + chalk.hex('#FFB732')("          ██████╔╝ █████╗   ███████║ ██║   ██║  ╚████╔╝  ██║"));
    logger.print(pad + chalk.hex('#FFC966')("          ██╔══██╗ ██╔══╝   ██╔══██║ ██║   ██║   ╚██╔╝   ╚═╝"));
    logger.print(pad + chalk.hex('#FFD280')("          ██║  ██║ ███████╗ ██║  ██║ ████████║    ██║    ██╗"));
    logger.print(pad + chalk.hex('#FFDB99')("          ╚═╝  ╚═╝ ╚══════╝ ╚═╝  ╚═╝ ╚═══════╝    ╚═╝    ╚═╝"));
    logger.print("");
    logger.print("");
    
    // Project info centered
    const projectInfoLine = `🎯 Project ${projectId}: ${projectName}`;
    const projectInfoWidth = stringWidth(projectInfoLine);
    const projectInfoPad = pad + ' '.repeat(Math.floor((60 - projectInfoWidth) / 2));
    logger.print(projectInfoPad + chalk.bold.hex('#FF8C00')(projectInfoLine));
    logger.print("");
    logger.print("");
    
    // Three agents visual - dynamic box sizing
    const agents = [
        { label: "Product Manager", icons: "📝", color: '#4169E1', lightColor: '#5B9BDF' },
        { label: "UX/UI Designer", icons: "🎨", color: '#9B59B6', lightColor: '#BB8FCE' },
        { label: "Engineer", icons: "🤖", color: '#27AE60', lightColor: '#52D98B' }
    ];
    
    // Calculate box width based on longest label + padding
    const maxLabelWidth = Math.max(...agents.map(a => stringWidth(a.label)));
    const boxPadding = 4; // 2 spaces on each side
    const boxContentWidth = Math.max(maxLabelWidth, stringWidth("📊 💼")) + boxPadding;
    const boxWidth = boxContentWidth + 2; // +2 for the border characters
    
    // Calculate total width and center padding
    const columnGap = 2;
    const totalWidth = (boxWidth * 3) + (columnGap * 2);
    const agentsPad = pad + ' '.repeat(Math.max(0, Math.floor((60 - totalWidth) / 2)));
    
    // Helper to create centered content within box
    const centerInBox = (content: string, width: number): string => {
        const contentWidth = stringWidth(content);
        const totalPadding = Math.max(0, width - contentWidth);
        const leftPad = Math.floor(totalPadding / 2);
        const rightPad = totalPadding - leftPad; // Ensure leftPad + rightPad = totalPadding exactly
        return ' '.repeat(leftPad) + content + ' '.repeat(rightPad);
    };
    
    // Helper to create horizontal border
    const createBorder = (type: 'top' | 'middle' | 'bottom'): string => {
        const chars = {
            top: { left: '╔', middle: '╦', right: '╗', fill: '═' },
            middle: { left: '╠', middle: '╬', right: '╣', fill: '═' },
            bottom: { left: '╚', middle: '╩', right: '╝', fill: '═' }
        };
        const c = chars[type];
        const line = c.left + c.fill.repeat(Math.max(0, boxContentWidth)) + c.right;
        return agents.map((a, i) => chalk.hex(a.color)(line)).join(' '.repeat(columnGap));
    };
    
    // Top border
    logger.print(agentsPad + createBorder('top'));
    
    // Icons row
    const iconsLine = agents.map(a => {
        const centered = centerInBox(a.icons, boxContentWidth);
        return chalk.hex(a.color)("║") + chalk.hex(a.lightColor)(centered) + chalk.hex(a.color)("║");
    }).join(' '.repeat(columnGap));
    logger.print(agentsPad + iconsLine);
    
    // Middle border
    logger.print(agentsPad + createBorder('middle'));
    
    // Labels row
    const labelsLine = agents.map(a => {
        const centered = centerInBox(a.label, boxContentWidth);
        return chalk.hex(a.color)("║") + chalk.bold.hex(a.lightColor)(centered) + chalk.hex(a.color)("║");
    }).join(' '.repeat(columnGap));
    logger.print(agentsPad + labelsLine);
    
    // Bottom border
    logger.print(agentsPad + createBorder('bottom'));
    
    logger.print("");
};


