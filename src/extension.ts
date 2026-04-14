import * as vscode from 'vscode';
import { DigimonViewProvider } from './panel';

import { DIGIMON_DEFS, DigimonType } from './types';

export function activate(context: vscode.ExtensionContext) {
    const provider = new DigimonViewProvider(context.extensionUri);

    // Register the sidebar webview — same as vscode-pets
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('digimon.viewport', provider)
    );

    // Status bar item
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

        // Spawn a Digimon using QuickPick
        vscode.commands.registerCommand('vscode-digimon.spawn', async () => {
            const availableTypes = (Object.keys(DIGIMON_DEFS) as DigimonType[])
                .filter(type => !provider.activeDigimons.includes(type))
                .map(type => ({
                    label: DIGIMON_DEFS[type].label,
                    type: type
                }));

            if (availableTypes.length === 0) {
                vscode.window.showInformationMessage("You already have all available Digimons spawned!");
                return;
            }

            const choice = await vscode.window.showQuickPick(availableTypes, { placeHolder: 'Choose a Digimon to summon' });
            if (choice) {
                provider.postMessage({ command: 'spawn-digimon', type: choice.type });
            }
        }),

        // Remove a Digimon using QuickPick
        vscode.commands.registerCommand('vscode-digimon.remove-all', async () => {
            if (provider.activeDigimons.length === 0) {
                vscode.window.showInformationMessage("There are no Digimons currently to remove!");
                return;
            }

            const activeTypes = provider.activeDigimons.map(type => ({
                label: DIGIMON_DEFS[type as DigimonType].label,
                type: type
            }));

            const choice = await vscode.window.showQuickPick(activeTypes, { placeHolder: 'Which Digimon would you like to remove?' });
            if (choice) {
                provider.postMessage({ command: 'remove-digimon', type: choice.type });
            }
        }),
    );
}

export function deactivate() {}
