import { App, normalizePath, TAbstractFile, TFile, TFolder } from 'obsidian';
import type { TodoPluginSettings } from './settings';

const TODO_PATTERN = /^\s*- \[ \] 202\d.*$/;
const UNCHECKED_TASK_MARKER = /^(\s*- \[) \]/;

interface TodoMatch {
	line: string;
	lineNumber: number;
	sourcePath: string;
	sourceLine: string;
}

export async function refreshTodoIndex(
	app: App,
	settings: TodoPluginSettings,
): Promise<void> {
	const scanFolders = normalizeScanFolders(settings.scanFolders);
	const outputFile = normalizeOutputFile(settings.outputFile);

	await writeOutputFile(outputFile, renderTodoIndex(scanFolders), app);
}

export async function renderTodoBlock(
	app: App,
	settings: TodoPluginSettings,
	source: string,
	el: HTMLElement,
): Promise<void> {
	el.empty();
	el.addClass('todo-plugin-view');

	const scanFolders = getBlockScanFolders(source, settings);
	const outputFile = normalizeOutputFile(settings.outputFile);
	const tasks = await collectTodos(app, scanFolders, outputFile);

	if (tasks.length === 0) {
		el.createEl('p', { text: 'No matching todos found.' });
		return;
	}

	const listEl = el.createEl('ul');
	for (const task of tasks) {
		const itemEl = listEl.createEl('li');
		const checkboxEl = itemEl.createEl('input', { type: 'checkbox' });
		checkboxEl.addClass('task-list-item-checkbox');

		itemEl.createSpan({ text: ` ${task.line.replace(/^- \[ \]\s*/, '')} ` });

		const linkEl = itemEl.createEl('a', { text: task.sourcePath });
		linkEl.href = '#';
		linkEl.addEventListener('click', (event) => {
			event.preventDefault();
			void app.workspace.openLinkText(
				task.sourcePath.replace(/\.md$/i, ''),
				settings.outputFile,
			);
		});

		checkboxEl.addEventListener('change', () => {
			checkboxEl.disabled = true;
			void completeTaskAndUpdateElement(app, task, itemEl, listEl, checkboxEl, el);
		});
	}
}

async function completeTaskAndUpdateElement(
	app: App,
	task: TodoMatch,
	itemEl: HTMLLIElement,
	listEl: HTMLUListElement,
	checkboxEl: HTMLInputElement,
	rootEl: HTMLElement,
): Promise<void> {
	if (await completeSourceTask(app, task)) {
		itemEl.remove();
		if (!listEl.querySelector('li')) {
			rootEl.empty();
			rootEl.addClass('todo-plugin-view');
			rootEl.createEl('p', { text: 'No matching todos found.' });
		}
		return;
	}

	checkboxEl.checked = false;
	checkboxEl.disabled = false;
	console.warn('Could not find the original task to complete.', task);
}

async function collectTodos(
	app: App,
	scanFolders: string[],
	outputFile: string,
): Promise<TodoMatch[]> {
	const tasks: TodoMatch[] = [];
	const files = getMarkdownFilesInFolders(app, scanFolders);

	for (const file of files) {
		if (file.path === outputFile) {
			continue;
		}

		const content = await app.vault.cachedRead(file);
		const lines = content.split(/\r?\n/);
		for (const [lineNumber, line] of lines.entries()) {
			if (TODO_PATTERN.test(line)) {
				tasks.push({
					line: line.trimStart(),
					lineNumber,
					sourcePath: file.path,
					sourceLine: line,
				});
			}
		}
	}

	return tasks;
}

function getMarkdownFilesInFolders(app: App, scanFolders: string[]): TFile[] {
	const files: TFile[] = [];

	for (const folderPath of scanFolders) {
		const folder = app.vault.getAbstractFileByPath(folderPath);
		if (!(folder instanceof TFolder)) {
			console.warn(`Todo Plugin: scan folder not found: ${folderPath}`);
			continue;
		}

		collectMarkdownFiles(folder, files);
	}

	return files;
}

function collectMarkdownFiles(folder: TFolder, files: TFile[]): void {
	for (const child of folder.children) {
		if (child instanceof TFolder) {
			collectMarkdownFiles(child, files);
			continue;
		}

		if (isMarkdownFile(child)) {
			files.push(child);
		}
	}
}

function isMarkdownFile(file: TAbstractFile): file is TFile {
	return file instanceof TFile && file.extension === 'md';
}

function renderTodoIndex(scanFolders: string[]): string {
	return [
		'```todo-plugin',
		'folders:',
		...scanFolders.map((folder) => `- ${folder}`),
		'```',
		'',
	].join('\n');
}

async function completeSourceTask(
	app: App,
	task: TodoMatch,
): Promise<boolean> {
	const sourceFile = app.vault.getAbstractFileByPath(task.sourcePath);

	if (!(sourceFile instanceof TFile)) {
		return false;
	}

	let completed = false;

	await app.vault.process(sourceFile, (data) => {
		const lineEnding = data.includes('\r\n') ? '\r\n' : '\n';
		const lines = data.split(/\r?\n/);
		const lineIndex = findSourceLine(lines, task);

		if (lineIndex === -1) {
			return data;
		}

		const sourceLine = lines[lineIndex];
		if (!sourceLine || !UNCHECKED_TASK_MARKER.test(sourceLine)) {
			return data;
		}

		lines[lineIndex] = sourceLine.replace(UNCHECKED_TASK_MARKER, '$1x]');
		completed = true;
		return lines.join(lineEnding);
	});

	return completed;
}

function findSourceLine(lines: string[], task: TodoMatch): number {
	if (lines[task.lineNumber] === task.sourceLine) {
		return task.lineNumber;
	}

	const exactMatch = lines.findIndex((line) => line === task.sourceLine);
	if (exactMatch !== -1) {
		return exactMatch;
	}

	return lines.findIndex(
		(line) => line.trimStart() === task.sourceLine.trimStart(),
	);
}

async function writeOutputFile(
	outputFile: string,
	content: string,
	app: App,
): Promise<void> {
	const existing = app.vault.getAbstractFileByPath(outputFile);

	if (existing instanceof TFile) {
		await app.vault.modify(existing, content);
		return;
	}

	if (existing) {
		throw new Error(`Cannot write todo index: ${outputFile} is not a file.`);
	}

	await ensureParentFolder(app, outputFile);
	await app.vault.create(outputFile, content);
}

async function ensureParentFolder(app: App, filePath: string): Promise<void> {
	const parts = filePath.split('/');
	parts.pop();

	let currentPath = '';
	for (const part of parts) {
		currentPath = currentPath ? `${currentPath}/${part}` : part;
		const existing = app.vault.getAbstractFileByPath(currentPath);

		if (existing instanceof TFolder) {
			continue;
		}

		if (existing) {
			throw new Error(
				`Cannot create folder ${currentPath}: a file exists at that path.`,
			);
		}

		await app.vault.createFolder(currentPath);
	}
}

function getBlockScanFolders(
	source: string,
	settings: TodoPluginSettings,
): string[] {
	const blockFolders = parseBlockScanFolders(source);
	return normalizeScanFolders(
		blockFolders.length > 0 ? blockFolders : settings.scanFolders,
	);
}

function parseBlockScanFolders(source: string): string[] {
	const folders: string[] = [];
	let readingFolderList = false;

	for (const rawLine of source.split(/\r?\n/)) {
		const line = rawLine.trim();

		if (!line) {
			continue;
		}

		if (readingFolderList && line.startsWith('- ')) {
			folders.push(line.slice(2).trim());
			continue;
		}

		readingFolderList = false;
		const foldersMatch = line.match(/^folders\s*:\s*(.*)$/i);
		if (!foldersMatch) {
			continue;
		}

		const inlineFolders = foldersMatch[1]?.trim();
		if (inlineFolders) {
			folders.push(
				...inlineFolders
					.split(',')
					.map((folder) => folder.trim())
					.filter(Boolean),
			);
		} else {
			readingFolderList = true;
		}
	}

	return folders;
}

function normalizeScanFolders(scanFolders: string[]): string[] {
	const normalized = scanFolders.map(normalizeFolderPath).filter(Boolean);

	if (normalized.length === 0) {
		throw new Error('Set at least one folder to scan.');
	}

	return normalized;
}

function normalizeOutputFile(outputFile: string): string {
	const normalized = normalizePath(outputFile.trim()).replace(/^\/+/, '');

	if (!normalized) {
		throw new Error('Set an output file.');
	}

	if (!normalized.toLowerCase().endsWith('.md')) {
		throw new Error('Output file must end in .md.');
	}

	return normalized;
}

function normalizeFolderPath(folder: string): string {
	return normalizePath(folder.trim()).replace(/^\/+|\/+$/g, '');
}
