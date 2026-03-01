import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Checks if the official coolify-cli binary is installed on the user's system paths.
 */
export async function isCoolifyCliInstalled(): Promise<boolean> {
    try {
        await execAsync('coolify --version');
        return true;
    } catch {
        return false;
    }
}

/**
 * Spawns a new VS Code Integrated Terminal running the requested Coolify CLI command.
 * The terminal immediately takes focus and runs the command.
 * 
 * @param command - The coolify subcommand to run (e.g. `logs tail <uuid>`)
 * @param terminalName - The display name for the terminal tab
 */
export async function runCliCommandInTerminal(command: string, terminalName: string = 'Coolify CLI'): Promise<void> {
    // Check if a terminal with this name already exists; if not, create it
    const existingTerminal = vscode.window.terminals.find(t => t.name === terminalName);
    const terminal = existingTerminal || vscode.window.createTerminal(terminalName);

    terminal.show();

    // Explicitly send the coolify command with arguments
    terminal.sendText(`coolify ${command}`);
}
