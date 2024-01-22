// Library
import * as vscode from 'vscode';

// -------
// WEBVIEW
// -------

export class Webview {

    // STATIC
    // ------

    /** The title of the webview panel */
    private static readonly title = 'Webview';

    /** Identifies the type of the webview */
    public static readonly viewType = 'tablePreview';

    /** Tracks the current panel. Only one is allowed to exist at a time */
    public static currentPanel: Webview | undefined;

    /** Create a new panel */
    public static create(
        extensionUri: vscode.Uri,
        viewColumn: vscode.ViewColumn = vscode.ViewColumn.One,
    ): Webview {
        const panel = vscode.window.createWebviewPanel(
            this.viewType,
            this.title,
            viewColumn,
            this.getWebviewOptions(extensionUri),
        );
        return new Webview(panel, extensionUri);
    }

    /**
     * Show the webview panel
     * The panel is created if it does not already exist
    */
    public static render(extensionUri: vscode.Uri) {
        // Determine the column to show the webview in
        const viewColumn = vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One;

        // If we already have a panel, show it
        if (Webview.currentPanel) {
            Webview.currentPanel.panel.reveal(viewColumn);
        } else {
            // Otherwise, create a new panel
            this.currentPanel = this.create(extensionUri, viewColumn);
        }
    }

    /** Revive the webview panel */
    public static revive(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this.currentPanel = new Webview(panel, extensionUri);
    }

    // INSTANCE
    // --------

    private constructor(
        private readonly panel: vscode.WebviewPanel,
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
            if (this.panel.visible) {
                this.update();
            }
        }, null, this.disposables);
    }

    /** A collection of disposables to dispose when the panel is disposed */
    private disposables: vscode.Disposable[] = [];

    /** Dispose off the current panel and related disposables */
    private dispose() {
        Webview.currentPanel = undefined; // Unset current panel
        this.panel.dispose();   // Dispose off the panel
        while (this.disposables.length) {
            const disposable = this.disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }

    /** Send a message to the webview */
    public postMessage<T>(message: Message<T>) {
        this.panel.webview.postMessage(message);
    }

    /** Handle messages from the webview */
    private handleMessage(message: Message) {
        switch (message.command) {
            case 'alert':
                vscode.window.showErrorMessage(message.data);
                return;
        }
    }

    /** Update the webview */
    private update() {
        this.panel.title = "WEBVIEW";
        this.panel.webview.html = this.getHtmlForWebview();
    }

    /** Get the html content for the webview */
    private getHtmlForWebview(): string {

        // Local path to script and css for the webview
        const scriptUri = this.getWebviewUri('media', 'index.js');
        const styleUri = this.getWebviewUri('media', 'vscode.css');
        const cssResetUri = this.getWebviewUri('media', 'reset.css');

        // Use a nonce to allow only specific scripts to run
        const nonce = this.generateNonce();

        return `<!DOCTYPE html>
        <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">

                <!--
                    Use a content security policy to only allow loading images from https or from our extension directory,
                    and only allow scripts that have a specific nonce.
                -->
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${this.panel.webview.cspSource}; img-src ${this.panel.webview.cspSource} https:; script-src 'nonce-${nonce}';">

                <link href="${cssResetUri}" rel="stylesheet">
				<link href="${styleUri}" rel="stylesheet">

                <script type="module" nonce="${nonce}" src="${scriptUri}"></script>

                <title>Webview</title>
            </head>

            <body>
                <h1>Hello World!</h1>
            </body>
        </html>
        `;
    }

    // HELPER METHODS
    // --------------

    /** Get the webview options */
    public static getWebviewOptions(extensionUri: vscode.Uri): vscode.WebviewOptions {
        return {
            // Enable JavaScript in the webview
            enableScripts: true,
            // Restrict the webview to only loading content from our extension's `media` directory.
            localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')]
        };
    }

    /** Get the uri for the webview resource */
    private getWebviewUri(...pathSegments: string[]): vscode.Uri {
        const path = vscode.Uri.joinPath(this.extensionUri, ...pathSegments);
        return this.panel.webview.asWebviewUri(path);
    }

    /** Generate a nonce to be used in the webview */
    private generateNonce(): string {
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let nonce = '';
        for (let i = 0; i < 32; i++) {
            nonce += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return nonce;
    }

}

// ----------------
// TYPE DEFINITIONS
// ----------------

type Message<T = string> = {
    command: string
    data: T
};
