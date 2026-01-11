import * as vscode from 'vscode';
import domCompletions from './dom-completions.json';

// Map HTML tag names to their corresponding TypeScript DOM types
const TAG_TO_TYPE: Record<string, string> = {
	a: 'HTMLAnchorElement',
	abbr: 'HTMLElement',
	address: 'HTMLElement',
	area: 'HTMLAreaElement',
	article: 'HTMLElement',
	aside: 'HTMLElement',
	audio: 'HTMLAudioElement',
	b: 'HTMLElement',
	base: 'HTMLBaseElement',
	bdi: 'HTMLElement',
	bdo: 'HTMLElement',
	blockquote: 'HTMLQuoteElement',
	body: 'HTMLBodyElement',
	br: 'HTMLBRElement',
	button: 'HTMLButtonElement',
	canvas: 'HTMLCanvasElement',
	caption: 'HTMLTableCaptionElement',
	cite: 'HTMLElement',
	code: 'HTMLElement',
	col: 'HTMLTableColElement',
	colgroup: 'HTMLTableColElement',
	data: 'HTMLDataElement',
	datalist: 'HTMLDataListElement',
	dd: 'HTMLElement',
	del: 'HTMLModElement',
	details: 'HTMLDetailsElement',
	dfn: 'HTMLElement',
	dialog: 'HTMLDialogElement',
	div: 'HTMLDivElement',
	dl: 'HTMLDListElement',
	dt: 'HTMLElement',
	em: 'HTMLElement',
	embed: 'HTMLEmbedElement',
	fieldset: 'HTMLFieldSetElement',
	figcaption: 'HTMLElement',
	figure: 'HTMLElement',
	footer: 'HTMLElement',
	form: 'HTMLFormElement',
	h1: 'HTMLHeadingElement',
	h2: 'HTMLHeadingElement',
	h3: 'HTMLHeadingElement',
	h4: 'HTMLHeadingElement',
	h5: 'HTMLHeadingElement',
	h6: 'HTMLHeadingElement',
	head: 'HTMLHeadElement',
	header: 'HTMLElement',
	hgroup: 'HTMLElement',
	hr: 'HTMLHRElement',
	html: 'HTMLHtmlElement',
	i: 'HTMLElement',
	iframe: 'HTMLIFrameElement',
	img: 'HTMLImageElement',
	input: 'HTMLInputElement',
	ins: 'HTMLModElement',
	kbd: 'HTMLElement',
	label: 'HTMLLabelElement',
	legend: 'HTMLLegendElement',
	li: 'HTMLLIElement',
	link: 'HTMLLinkElement',
	main: 'HTMLElement',
	map: 'HTMLMapElement',
	mark: 'HTMLElement',
	menu: 'HTMLMenuElement',
	meta: 'HTMLMetaElement',
	meter: 'HTMLMeterElement',
	nav: 'HTMLElement',
	noscript: 'HTMLElement',
	object: 'HTMLObjectElement',
	ol: 'HTMLOListElement',
	optgroup: 'HTMLOptGroupElement',
	option: 'HTMLOptionElement',
	output: 'HTMLOutputElement',
	p: 'HTMLParagraphElement',
	picture: 'HTMLPictureElement',
	pre: 'HTMLPreElement',
	progress: 'HTMLProgressElement',
	q: 'HTMLQuoteElement',
	rp: 'HTMLElement',
	rt: 'HTMLElement',
	ruby: 'HTMLElement',
	s: 'HTMLElement',
	samp: 'HTMLElement',
	script: 'HTMLScriptElement',
	section: 'HTMLElement',
	select: 'HTMLSelectElement',
	slot: 'HTMLSlotElement',
	small: 'HTMLElement',
	source: 'HTMLSourceElement',
	span: 'HTMLSpanElement',
	strong: 'HTMLElement',
	style: 'HTMLStyleElement',
	sub: 'HTMLElement',
	summary: 'HTMLElement',
	sup: 'HTMLElement',
	table: 'HTMLTableElement',
	tbody: 'HTMLTableSectionElement',
	td: 'HTMLTableCellElement',
	template: 'HTMLTemplateElement',
	textarea: 'HTMLTextAreaElement',
	tfoot: 'HTMLTableSectionElement',
	th: 'HTMLTableCellElement',
	thead: 'HTMLTableSectionElement',
	time: 'HTMLTimeElement',
	title: 'HTMLTitleElement',
	tr: 'HTMLTableRowElement',
	track: 'HTMLTrackElement',
	u: 'HTMLElement',
	ul: 'HTMLUListElement',
	var: 'HTMLElement',
	video: 'HTMLVideoElement',
	wbr: 'HTMLElement',
};

interface IdInfo {
	tagName: string;
	type: string;
	line: number;
	column: number;
	uri: vscode.Uri;
}

interface CompletionEntry {
	name: string;
	kind: vscode.CompletionItemKind;
}

// Global state
let idMap: Map<string, IdInfo[]> = new Map();
let diagnosticCollection: vscode.DiagnosticCollection;

// Cache for completions per element type
const completionCache: Map<string, CompletionEntry[]> = new Map();

function getCompletionsForType(typeName: string): CompletionEntry[] {
	if (completionCache.has(typeName)) {
		return completionCache.get(typeName)!;
	}

	const typeData = (domCompletions as Record<string, [string, 0 | 1][]>)[typeName];
	if (!typeData) {
		return [];
	}

	const entries: CompletionEntry[] = typeData.map(([name, isMethod]) => ({
		name,
		kind: isMethod ? vscode.CompletionItemKind.Method : vscode.CompletionItemKind.Property,
	}));

	completionCache.set(typeName, entries);
	return entries;
}

function parseHtmlIds(document: vscode.TextDocument): Map<string, IdInfo[]> {
	const ids = new Map<string, IdInfo[]>();
	const text = document.getText();
	
	const idRegex = /<(\w+)(?=[^>]*\sid=["']([^"']+)["'])[^>]*>/gi;
	
	let match: RegExpExecArray | null;
	while ((match = idRegex.exec(text)) !== null) {
		const tagName = match[1].toLowerCase();
		const idValue = match[2];
		const position = document.positionAt(match.index);
		
		const tagText = match[0];
		const idAttrMatch = /\sid=["']([^"']+)["']/.exec(tagText);
		let idColumn = position.character;
		if (idAttrMatch) {
			idColumn = position.character + tagText.indexOf(idAttrMatch[0]) + idAttrMatch[0].indexOf(idAttrMatch[1]);
		}
		
		const info: IdInfo = {
			tagName,
			type: TAG_TO_TYPE[tagName] || 'HTMLElement',
			line: position.line,
			column: idColumn,
			uri: document.uri,
		};
		
		if (!ids.has(idValue)) {
			ids.set(idValue, []);
		}
		ids.get(idValue)!.push(info);
	}
	
	return ids;
}

function updateDiagnostics(ids: Map<string, IdInfo[]>): void {
	const diagnosticsByUri = new Map<string, vscode.Diagnostic[]>();
	
	for (const [id, infos] of ids) {
		if (infos.length > 1) {
			for (const info of infos) {
				const uriString = info.uri.toString();
				if (!diagnosticsByUri.has(uriString)) {
					diagnosticsByUri.set(uriString, []);
				}
				
				const range = new vscode.Range(
					info.line,
					info.column,
					info.line,
					info.column + id.length
				);
				
				const diagnostic = new vscode.Diagnostic(
					range,
					`Duplicate id "${id}" found ${infos.length} times. IDs must be unique.`,
					vscode.DiagnosticSeverity.Error
				);
				diagnostic.source = 'html-id-intellisense';
				
				diagnosticsByUri.get(uriString)!.push(diagnostic);
			}
		}
	}
	
	diagnosticCollection.clear();
	for (const [uriString, diagnostics] of diagnosticsByUri) {
		diagnosticCollection.set(vscode.Uri.parse(uriString), diagnostics);
	}
}

function isInsideScriptTag(document: vscode.TextDocument, position: vscode.Position): boolean {
	const text = document.getText();
	const offset = document.offsetAt(position);
	
	const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
	let match: RegExpExecArray | null;
	
	while ((match = scriptRegex.exec(text)) !== null) {
		const scriptStart = match.index + match[0].indexOf('>') + 1;
		const scriptEnd = match.index + match[0].lastIndexOf('</script>');
		
		if (offset >= scriptStart && offset <= scriptEnd) {
			return true;
		}
	}
	
	return false;
}

function getWordAtPosition(document: vscode.TextDocument, position: vscode.Position): string | undefined {
	const wordRange = document.getWordRangeAtPosition(position, /[a-zA-Z_$][a-zA-Z0-9_$]*/);
	if (wordRange) {
		return document.getText(wordRange);
	}
	return undefined;
}

function getIdentifierBeforeDot(document: vscode.TextDocument, position: vscode.Position): string | undefined {
	const line = document.lineAt(position.line).text;
	const textBeforeCursor = line.substring(0, position.character);
	
	const match = textBeforeCursor.match(/([a-zA-Z_$][a-zA-Z0-9_$]*)\.([a-zA-Z_$][a-zA-Z0-9_$]*)?$/);
	if (match) {
		return match[1];
	}
	return undefined;
}

function scanDocument(document: vscode.TextDocument): void {
	if (document.languageId !== 'html') {
		return;
	}
	
	idMap = parseHtmlIds(document);
	updateDiagnostics(idMap);
}

export function activate(context: vscode.ExtensionContext): void {
	console.log('html-id-intellisense is now active');
	
	diagnosticCollection = vscode.languages.createDiagnosticCollection('html-id-intellisense');
	context.subscriptions.push(diagnosticCollection);
	
	if (vscode.window.activeTextEditor) {
		scanDocument(vscode.window.activeTextEditor.document);
	}
	
	context.subscriptions.push(
		vscode.workspace.onDidChangeTextDocument((event) => {
			if (event.document.languageId === 'html') {
				scanDocument(event.document);
			}
		})
	);
	
	context.subscriptions.push(
		vscode.window.onDidChangeActiveTextEditor((editor) => {
			if (editor && editor.document.languageId === 'html') {
				scanDocument(editor.document);
			}
		})
	);
	
	context.subscriptions.push(
		vscode.workspace.onDidOpenTextDocument((document) => {
			if (document.languageId === 'html') {
				scanDocument(document);
			}
		})
	);
	
	const idCompletionProvider = vscode.languages.registerCompletionItemProvider(
		'html',
		{
			provideCompletionItems(document, position) {
				if (!isInsideScriptTag(document, position)) {
					return undefined;
				}
				
				const line = document.lineAt(position.line).text;
				const textBeforeCursor = line.substring(0, position.character);
				if (textBeforeCursor.match(/\.\s*[a-zA-Z_$]*$/)) {
					return undefined;
				}
				
				const completionItems: vscode.CompletionItem[] = [];
				
				for (const [id, infos] of idMap) {
					const info = infos[0];
					const item = new vscode.CompletionItem(id, vscode.CompletionItemKind.Variable);
					item.detail = info.type;
					item.documentation = new vscode.MarkdownString(
						`HTML element with id="${id}"\n\nType: \`${info.type}\`\n\nTag: \`<${info.tagName}>\``
					);
					item.sortText = '0' + id;
					completionItems.push(item);
				}
				
				return completionItems;
			}
		}
	);
	context.subscriptions.push(idCompletionProvider);
	
	const dotCompletionProvider = vscode.languages.registerCompletionItemProvider(
		'html',
		{
			provideCompletionItems(document, position) {
				if (!isInsideScriptTag(document, position)) {
					return undefined;
				}
				
				const idName = getIdentifierBeforeDot(document, position);
				if (!idName || !idMap.has(idName)) {
					return undefined;
				}
				
				const infos = idMap.get(idName)!;
				const typeName = infos[0].type;
				
				const typeCompletions = getCompletionsForType(typeName);
				
				return typeCompletions.map(entry => {
					const item = new vscode.CompletionItem(entry.name, entry.kind);
					item.sortText = '0' + entry.name;
					return item;
				});
			}
		},
		'.'
	);
	context.subscriptions.push(dotCompletionProvider);
	
	const definitionProvider = vscode.languages.registerDefinitionProvider(
		'html',
		{
			provideDefinition(document, position) {
				if (!isInsideScriptTag(document, position)) {
					return undefined;
				}
				
				const word = getWordAtPosition(document, position);
				if (!word || !idMap.has(word)) {
					return undefined;
				}
				
				const infos = idMap.get(word)!;
				
				return infos.map(info => new vscode.Location(
					info.uri,
					new vscode.Position(info.line, info.column)
				));
			}
		}
	);
	context.subscriptions.push(definitionProvider);
	
	const hoverProvider = vscode.languages.registerHoverProvider(
		'html',
		{
			provideHover(document, position) {
				if (!isInsideScriptTag(document, position)) {
					return undefined;
				}
				
				const word = getWordAtPosition(document, position);
				if (!word || !idMap.has(word)) {
					return undefined;
				}
				
				const infos = idMap.get(word)!;
				const info = infos[0];
				
				const markdown = new vscode.MarkdownString();
				markdown.appendCodeblock(`const ${word}: ${info.type}`, 'typescript');
				markdown.appendMarkdown(`\n\nHTML element: \`<${info.tagName} id="${word}">\``);
				
				if (infos.length > 1) {
					markdown.appendMarkdown(`\n\n⚠️ **Warning:** This ID is duplicated ${infos.length} times`);
				}
				
				return new vscode.Hover(markdown);
			}
		}
	);
	context.subscriptions.push(hoverProvider);
}

export function deactivate(): void {}
