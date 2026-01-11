import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';

const ELEMENT_TYPES = [
	'HTMLElement',
	'HTMLAnchorElement',
	'HTMLAreaElement',
	'HTMLAudioElement',
	'HTMLBaseElement',
	'HTMLBodyElement',
	'HTMLBRElement',
	'HTMLButtonElement',
	'HTMLCanvasElement',
	'HTMLDataElement',
	'HTMLDataListElement',
	'HTMLDetailsElement',
	'HTMLDialogElement',
	'HTMLDivElement',
	'HTMLDListElement',
	'HTMLEmbedElement',
	'HTMLFieldSetElement',
	'HTMLFormElement',
	'HTMLHeadElement',
	'HTMLHeadingElement',
	'HTMLHRElement',
	'HTMLHtmlElement',
	'HTMLIFrameElement',
	'HTMLImageElement',
	'HTMLInputElement',
	'HTMLLabelElement',
	'HTMLLegendElement',
	'HTMLLIElement',
	'HTMLLinkElement',
	'HTMLMapElement',
	'HTMLMenuElement',
	'HTMLMetaElement',
	'HTMLMeterElement',
	'HTMLModElement',
	'HTMLObjectElement',
	'HTMLOListElement',
	'HTMLOptGroupElement',
	'HTMLOptionElement',
	'HTMLOutputElement',
	'HTMLParagraphElement',
	'HTMLPictureElement',
	'HTMLPreElement',
	'HTMLProgressElement',
	'HTMLQuoteElement',
	'HTMLScriptElement',
	'HTMLSelectElement',
	'HTMLSlotElement',
	'HTMLSourceElement',
	'HTMLSpanElement',
	'HTMLStyleElement',
	'HTMLTableCaptionElement',
	'HTMLTableCellElement',
	'HTMLTableColElement',
	'HTMLTableElement',
	'HTMLTableRowElement',
	'HTMLTableSectionElement',
	'HTMLTemplateElement',
	'HTMLTextAreaElement',
	'HTMLTimeElement',
	'HTMLTitleElement',
	'HTMLTrackElement',
	'HTMLUListElement',
	'HTMLVideoElement',
];

// Format: [name, isMethod (1=method, 0=property)]
type CompletionEntry = [string, 0 | 1];
type CompletionsMap = Record<string, CompletionEntry[]>;

let virtualFileContent = '';

function createLanguageService(): ts.LanguageService {
	const virtualFileName = '/virtual.ts';

	const servicesHost: ts.LanguageServiceHost = {
		getScriptFileNames: () => [virtualFileName],
		getScriptVersion: () => '1',
		getScriptSnapshot: (fileName) => {
			if (fileName === virtualFileName) {
				return ts.ScriptSnapshot.fromString(virtualFileContent);
			}
			if (ts.sys.fileExists(fileName)) {
				const content = ts.sys.readFile(fileName);
				if (content) {
					return ts.ScriptSnapshot.fromString(content);
				}
			}
			return undefined;
		},
		getCurrentDirectory: () => '/',
		getCompilationSettings: () => ({
			target: ts.ScriptTarget.ESNext,
			module: ts.ModuleKind.ESNext,
			lib: ['lib.dom.d.ts', 'lib.es2020.d.ts'],
		}),
		getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
		fileExists: (fileName) => fileName === virtualFileName || ts.sys.fileExists(fileName),
		readFile: (fileName) => {
			if (fileName === virtualFileName) {
				return virtualFileContent;
			}
			return ts.sys.readFile(fileName);
		},
		readDirectory: ts.sys.readDirectory,
		directoryExists: ts.sys.directoryExists,
		getDirectories: ts.sys.getDirectories,
	};

	return ts.createLanguageService(servicesHost, ts.createDocumentRegistry());
}

function getCompletionsForType(service: ts.LanguageService, typeName: string): CompletionEntry[] {
	virtualFileContent = `declare var __el: ${typeName}; __el.`;

	const completions = service.getCompletionsAtPosition('/virtual.ts', virtualFileContent.length, {
		includeCompletionsForModuleExports: false,
		includeCompletionsWithInsertText: true,
	});

	if (!completions) {
		return [];
	}

	return completions.entries.map(entry => {
		const isMethod = entry.kind === ts.ScriptElementKind.memberFunctionElement ||
			entry.kind === ts.ScriptElementKind.functionElement;
		return [entry.name, isMethod ? 1 : 0] as CompletionEntry;
	});
}

function main() {
	console.log('Generating DOM completions...');
	const service = createLanguageService();
	const result: CompletionsMap = {};

	for (const typeName of ELEMENT_TYPES) {
		console.log(`  Processing ${typeName}...`);
		result[typeName] = getCompletionsForType(service, typeName);
	}

	const outPath = path.join(__dirname, '..', 'src', 'dom-completions.json');
	fs.writeFileSync(outPath, JSON.stringify(result));
	
	const stats = fs.statSync(outPath);
	console.log(`\nGenerated ${outPath}`);
	console.log(`Size: ${(stats.size / 1024).toFixed(1)} KB`);
	console.log(`Types: ${Object.keys(result).length}`);
	console.log(`Total completions: ${Object.values(result).reduce((sum, arr) => sum + arr.length, 0)}`);
}

main();
