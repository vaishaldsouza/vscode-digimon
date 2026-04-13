import * as vscode from 'vscode';
import { DigimonViewProvider } from './panel';

export function activate(context: vscode.ExtensionContext) {
    const provider = new DigimonViewProvider(context.extensionUri);

    // Register the sidebar webview — same as vscode-pets
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('digimon.viewport', provider)
    );

    // Status bar item — same as vscode-pets (shows pet name, opens panel on click)
    const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBar.text = '$(heart) Digimon';
    statusBar.tooltip = 'Open Digimon panel';
    statusBar.command = 'vscode-digimon.start';
    statusBar.show();
    context.subscriptions.push(statusBar);

    // Commands
    context.subscriptions.push(
        // Focus the panel
        vscode.commands.registerCommand('vscode-digimon.start', () => {
            vscode.commands.executeCommand('digimon.viewport.focus');
        }),

        // Spawn an additional Digimon — same as vscode-pets spawn-pet
        vscode.commands.registerCommand('vscode-digimon.spawn', () => {
            provider.postMessage({ command: 'spawn-digimon' });
        }),

        // Remove all extras — same as vscode-pets remove-all-pets
        vscode.commands.registerCommand('vscode-digimon.remove-all', () => {
            provider.postMessage({ command: 'remove-all' });
        }),
    );
}

export function deactivate() {}
