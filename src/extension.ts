// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

function onChange(evt: vscode.TextDocumentChangeEvent) {

}

const PATTERN_DEFINE = /^(define[^@]+)(@[-a-zA-Z$\._0-9\"]+)\(.+\{/;
const PATTERN_CALL = /^([^=]*=?\s*call[^@]+)(@[-a-zA-Z$\._0-9\"]+)\(.+/;
const PATTERN_INVOKE = /^([^=]*=?\s*invoke[^@]+)(@[-a-zA-Z$\._0-9\"]+)\(.+/;

class LLVMSymbol  {
	uri: vscode.Uri;
	symbol: vscode.DocumentSymbol;
	info: string[];
	
	constructor(uri: vscode.Uri, symbol: vscode.DocumentSymbol, info: string[] = []) {
		this.uri = uri;
		this.symbol = symbol;
		this.info = info;
	}
}

class LLVMDocumentSymbolProvider implements vscode.DocumentSymbolProvider, vscode.DefinitionProvider {
	functions: Map<string, vscode.DocumentSymbol> = new Map();

	public provideDocumentSymbols(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.DocumentSymbol[] {
		const comments: string[] = [];
		let currentFunc: vscode.Range | undefined = undefined;

		for (let li = 0; li < document.lineCount; li++) {
			let line = document.lineAt(li);

			if (currentFunc && line.text === '}') {
				let totalRange = new vscode.Range(
					currentFunc.start.with(undefined, 0),
					line.range.end,
				);
				let funcName = document.getText(currentFunc);
				let niceName = comments && !comments[0].startsWith('Function Attrs')
					? comments[0] : funcName;
				this.functions.set(funcName, new vscode.DocumentSymbol(
					niceName,
					'',
					vscode.SymbolKind.Function,
					totalRange,
					currentFunc,
				));
				currentFunc = undefined;
				continue;
			}

			let match = line.text.match(PATTERN_DEFINE);
			if (match) {
				currentFunc = new vscode.Range(
					line.range.start.with(undefined, match[1].length),
					line.range.end.with(undefined, match[1].length + match[2].length),
				);
				continue;
			}

			if (!currentFunc) {
				if (line.text.startsWith(';')) {
					comments.push(line.text.substring(1).trim());
				} else {
					comments.length = 0;
				}
			}
		}

		return Array.from(this.functions.values());
	}

	provideDefinition(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): vscode.DefinitionLink[] {
		let line = document.lineAt(position.line);
		let match = line.text.match(PATTERN_CALL) || line.text.match(PATTERN_INVOKE);
		if (match) {
			let range = new vscode.Range(
				position.with(undefined, match[1].length),
				position.with(undefined, match[1].length + match[2].length)
			);

			let symb = this.functions.get(match[2]);
			if (symb) {
				return [{
					originSelectionRange: range,
					targetUri: document.uri,
					targetRange: symb.range,
					targetSelectionRange: symb.selectionRange,
				}];
			}
		}
		return [];
	}
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "llvm-asm" is now active!');

	let symbolProvider = new LLVMDocumentSymbolProvider();
	vscode.languages.registerDocumentSymbolProvider('llvm', symbolProvider);
	vscode.languages.registerDefinitionProvider('llvm', symbolProvider);

	// vscode.workspace.onDidChangeTextDocument(onChange);
}

// this method is called when your extension is deactivated
export function deactivate() {}
