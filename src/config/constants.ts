import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'path';

// Get current directory (equivalent to SQUAD_DIR in bash)
export const __filename = fileURLToPath(import.meta.url);
export const __dirname = dirname(__filename);
export const SQUAD_DIR = path.resolve(__dirname, '..', '..');

// SpecWright directory structure
// In the installed package, these are at the root
// In the target project, these will be under specwright/
export const getSpecWrightDir = (targetDir: string = process.cwd()): string => {
    // Check if we're in the specwright package itself or a target project
    const packagePath = path.join(targetDir, 'package.json');
    try {
        const pkg = require(packagePath);
        if (pkg.name === 'specwright') {
            // We're in the specwright package itself (development mode)
            return targetDir;
        }
    } catch {
        // No package.json or not specwright
    }
    
    // Target project - use specwright/ subfolder
    return path.join(targetDir, 'specwright');
};

export const SPECWRIGHT_DIR = getSpecWrightDir();
export const OUTPUT_DIR = path.join(SPECWRIGHT_DIR, 'outputs');
export const TEMPLATES_DIR = path.join(SPECWRIGHT_DIR, 'templates');
export const AGENTS_DIR = path.join(SPECWRIGHT_DIR, 'agents');

// Create timestamp and session directories
export const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '_');
export const SESSION_DIR = path.join(OUTPUT_DIR, timestamp);

