// Library
import * as vscode from 'vscode';
import { generateNonce } from './utils';
import type { VSCodeMessage, WebviewMessage } from './types';

// -------
// WEBVIEW
// -------

export class Webview {

    // ------
    // STATIC
    // ------

    /** The title of the webview panel */
    private static readonly title = 'Table Preview';

    /** Identifies the type of the webview */
    public static readonly viewType = 'tablePreview';

    /** The column in which the webview should appear */
    private static readonly viewColumn = vscode.ViewColumn.Beside;

    /** Tracks the current panel. Only one is allowed to exist at a time */
    public static currentPanel: Webview | undefined;

    // CREATE/  RENDER / REVIVE
    // ------------------------

    /** Create a new panel */
    public static create(
        extensionUri: vscode.Uri,
        viewColumn: vscode.ViewColumn = this.viewColumn,
    ): Webview {
        const panel = vscode.window.createWebviewPanel(
            this.viewType,
            this.title,
            viewColumn,
            this.getOptions(extensionUri),
        );
        return new Webview(panel, extensionUri);
    }

    /**
     * Show the webview panel
     * The panel is created if it does not already exist
    */
    public static render(extensionUri: vscode.Uri, viewColumn: vscode.ViewColumn = this.viewColumn): Promise<void> {
        // If we already have a panel, show it
        if (Webview.currentPanel) {
            Webview.currentPanel.panel.reveal(viewColumn);
        } else {
            // Otherwise, create a new panel
            this.currentPanel = this.create(extensionUri, viewColumn);
        }

        // Return a promise that resolves when the webview sends a "ready" message (on page load)
        return new Promise((resolve, reject) => {
            this.currentPanel?.panel.webview.onDidReceiveMessage((message: WebviewMessage) => {
                if (message.command === 'ready') { resolve(); } else { reject(); }
            }, null, this.currentPanel?.disposables);
        });
    }

    /** Revive the webview panel */
    public static revive(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this.currentPanel = new Webview(panel, extensionUri);
    }

    // MESSAGE
    // -------

    /** Send a message to the webview */
    public static postMessage(message: VSCodeMessage) {
        this.currentPanel?.panel.webview.postMessage(message);
    }

    // OPTIONS
    // -------

    /** Get the options for the webview */
    private static getOptions(extensionUri: vscode.Uri): vscode.WebviewOptions {
        return {
            // Enable JavaScript in the webview
            enableScripts: true,
            // Restrict the webview to only loading content from our extension's `media` directory.
            localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'out')]
        };
    }

    // --------
    // INSTANCE
    // --------

    private constructor(
        public readonly panel: vscode.WebviewPanel,
        private readonly extensionUri: vscode.Uri
    ) {
        // Set the webview's initial html content
        this.update();

        // Listen for when the panel is disposed
        // This happens when the user closes the panel or when the panel is closed programmatically
        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

        // Handle messages from the webview
        this.panel.webview.onDidReceiveMessage(this.handleMessage, null, this.disposables);

        // Update the content based on the view changes
        this.panel.onDidChangeViewState(e => {
            if (this.panel.visible) { this.update(); }
        }, null, this.disposables);
    }

    // DISPOSE
    // -------

    /** A collection of disposables to dispose when the panel is disposed */
    private disposables: vscode.Disposable[] = [];

    /** Dispose off the current panel and related disposables */
    public dispose() {
        Webview.currentPanel = undefined; // Set current panel to undefined
        this.panel.dispose();   // Dispose off the panel
        while (this.disposables.length) {
            const disposable = this.disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }

    // MESSAGE
    // -------

    /** Handle messages from the webview */
    private handleMessage(message: WebviewMessage) {
        switch (message.command) {
            case 'error':
                vscode.window.showErrorMessage(message.data);
                return;
        }
    }

    // CONTENT
    // -------

    /** Update the webview */
    private update() {
        this.panel.webview.html = this.getHtmlForWebview();
    }

    /** Get the uri for the webview resource */
    private getWebviewUri(...pathSegments: string[]): vscode.Uri {
        const path = vscode.Uri.joinPath(this.extensionUri, ...pathSegments);
        return this.panel.webview.asWebviewUri(path);
    }

    /** Get the html content for the webview */
    private getHtmlForWebview(): string {

        // Local path to script and css for the webview
        const scriptUri = this.getWebviewUri('out', 'webview.js');

        // Use a nonce to allow only specific scripts to run
        const nonce = generateNonce();

        return `<!DOCTYPE html>
        <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">

                <!--
                    Use a content security policy to only allow loading images from https or from our extension directory,
                    and only allow scripts that have a specific nonce.
                -->
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}';">

                <script type="module" nonce="${nonce}" src="${scriptUri}"></script>

                <title>Webview</title>
            </head>

            <body>
                <vscode-text-field id="search" type="text" placeholder="Search..."></vscode-text-field>
                <table id="table"></table>
            </body>
        </html>
        `;
    }

}

