import { App, normalizePath, TAbstractFile, TFile, TFolder } from 'obsidian';
import type { TodoPluginSettings } from './settings';

const TODO_PATTERN = /^\s*- \[ \] 202\d.*$/;
const DUE_DATE_PATTERN = /\bdue:(\d{4}-\d{2}-\d{2})\b/i;
const UNCHECKED_TASK_MARKER = /^(\s*- \[) \]/;

type DueFilter = 'all' | 'today-plus-n' | 'this-week' | 'this-month';

interface TodoMatch {
	dueDate: string | null;
	line: string;
	lineNumber: number;
	sourcePath: string;
	sourceLine: string;
	text: string;
}

interface DueFilterOption {
	id: DueFilter;
	label: string;
}

interface TodoBlockOptions {
	filter: DueFilter;
	scanFolders: string[];
	todayOffset: number;
}

interface ParsedDueFilter {
	filter: DueFilter;
	todayOffset: number;
}

interface ParsedTodoBlock {
	filter: ParsedDueFilter | null;
	folders: string[];
}

const DUE_FILTERS: DueFilterOption[] = [
	{ id: 'all', label: 'All' },
	{ id: 'today-plus-n', label: 'Today + N' },
	{ id: 'this-week', label: 'This week' },
	{ id: 'this-month', label: 'This month' },
];

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

	const blockOptions = getBlockOptions(source, settings);
	const outputFile = normalizeOutputFile(settings.outputFile);
	let tasks = sortTodos(
		await collectTodos(app, blockOptions.scanFolders, outputFile),
	);
	let activeFilter = blockOptions.filter;

	if (tasks.length === 0) {
		el.createEl('p', { text: 'No matching todos found.' });
		return;
	}

	const controlsEl = el.createDiv();
	const filterEl = controlsEl.createEl('select');
	for (const filter of DUE_FILTERS) {
		filterEl.createEl('option', {
			text: filter.label,
			value: filter.id,
		});
	}
	filterEl.value = activeFilter;

	const offsetEl = controlsEl.createEl('input', {
		type: 'number',
		value: String(blockOptions.todayOffset),
	});
	offsetEl.min = '0';
	offsetEl.step = '1';
	offsetEl.inputMode = 'numeric';
	offsetEl.ariaLabel = 'Days from today';

	const listRootEl = el.createDiv();
	const renderList = () => {
		const today = getTodayDate();
		offsetEl.style.display = activeFilter === 'today-plus-n' ? '' : 'none';
		const visibleTasks = tasks.filter((task) =>
			matchesDueFilter(task, activeFilter, today, getTodayOffset(offsetEl)),
		);

		listRootEl.empty();
		if (visibleTasks.length === 0) {
			listRootEl.createEl('p', { text: 'No matching todos found.' });
			return;
		}

		const listEl = listRootEl.createEl('ul');
		for (const task of visibleTasks) {
			const itemEl = listEl.createEl('li');
			const checkboxEl = itemEl.createEl('input', { type: 'checkbox' });
			checkboxEl.addClass('task-list-item-checkbox');

			itemEl.createSpan({ text: ` ${task.text} ` });
			if (task.dueDate) {
				itemEl.createSpan({ text: `due ${task.dueDate} ` });
			}

			const linkEl = itemEl.createEl('a', { text: task.sourcePath });
			linkEl.href = '#';
			linkEl.addEventListener('click', (event) => {
				event.preventDefault();
				void app.workspace.openLinkText(
					task.sourcePath.replace(/\.md$/i, ''),
					outputFile,
				);
			});

			checkboxEl.addEventListener('change', () => {
				checkboxEl.disabled = true;
				void completeSourceTask(app, task)
					.then((completed) => {
						if (completed) {
							tasks = tasks.filter((candidate) => candidate !== task);
							renderList();
							return;
						}

						checkboxEl.checked = false;
						checkboxEl.disabled = false;
						console.warn('Could not find the original task to complete.', task);
					})
					.catch((error: unknown) => {
						checkboxEl.checked = false;
						checkboxEl.disabled = false;
						console.warn('Failed to complete the original task.', error);
					});
			});
		}
	};

	filterEl.addEventListener('change', () => {
		activeFilter = filterEl.value as DueFilter;
		renderList();
	});
	offsetEl.addEventListener('input', renderList);
	renderList();
}

function sortTodos(tasks: TodoMatch[]): TodoMatch[] {
	return tasks.sort((left, right) => {
		const leftDueDate = left.dueDate ?? '9999-12-31';
		const rightDueDate = right.dueDate ?? '9999-12-31';
		return (
			leftDueDate.localeCompare(rightDueDate) ||
			left.sourcePath.localeCompare(right.sourcePath) ||
			left.lineNumber - right.lineNumber
		);
	});
}

function matchesDueFilter(
	task: TodoMatch,
	filter: DueFilter,
	today: string,
	todayOffset: number,
): boolean {
	if (filter === 'all') {
		return true;
	}

	if (!task.dueDate) {
		return true;
	}

	if (filter === 'today-plus-n') {
		return task.dueDate === addDays(today, todayOffset);
	}

	if (filter === 'this-week') {
		return task.dueDate >= today && task.dueDate <= addDays(today, 6);
	}

	return task.dueDate >= today && task.dueDate <= endOfMonth(today);
}

function getTodayOffset(inputEl: HTMLInputElement): number {
	const offset = Number(inputEl.value);
	if (!Number.isFinite(offset) || offset < 0) {
		return 0;
	}

	return Math.floor(offset);
}

function getTaskText(line: string): string {
	return line
		.replace(/^- \[ \]\s*/, '')
		.replace(DUE_DATE_PATTERN, '')
		.replace(/\s{2,}/g, ' ')
		.trim();
}

function getDueDate(line: string): string | null {
	const dueDate = line.match(DUE_DATE_PATTERN)?.[1];
	if (!dueDate || !isValidDateOnly(dueDate)) {
		return null;
	}

	return dueDate;
}

function getTodayDate(): string {
	return formatDateOnly(new Date());
}

function addDays(value: string, days: number): string {
	const date = parseDateOnly(value);
	date.setDate(date.getDate() + days);
	return formatDateOnly(date);
}

function endOfMonth(value: string): string {
	const date = parseDateOnly(value);
	return formatDateOnly(new Date(date.getFullYear(), date.getMonth() + 1, 0));
}

function parseDateOnly(value: string): Date {
	const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (!match) {
		throw new Error(`Invalid date: ${value}`);
	}

	const yearText = match[1];
	const monthText = match[2];
	const dayText = match[3];
	if (!yearText || !monthText || !dayText) {
		throw new Error(`Invalid date: ${value}`);
	}

	return new Date(Number(yearText), Number(monthText) - 1, Number(dayText));
}

function formatDateOnly(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

function isValidDateOnly(value: string): boolean {
	const date = parseDateOnly(value);
	return formatDateOnly(date) === value;
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
				const normalizedLine = line.trimStart();
				tasks.push({
					dueDate: getDueDate(normalizedLine),
					line: normalizedLine,
					lineNumber,
					sourcePath: file.path,
					sourceLine: line,
					text: getTaskText(normalizedLine),
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

function getBlockOptions(
	source: string,
	settings: TodoPluginSettings,
): TodoBlockOptions {
	const block = parseTodoBlock(source);
	return {
		filter: block.filter?.filter ?? 'all',
		scanFolders: normalizeScanFolders(
			block.folders.length > 0 ? block.folders : settings.scanFolders,
		),
		todayOffset: block.filter?.todayOffset ?? 0,
	};
}

function parseTodoBlock(source: string): ParsedTodoBlock {
	const folders: string[] = [];
	let filter: ParsedDueFilter | null = null;
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

		const filterMatch = line.match(/^filter\s*:\s*(.*)$/i);
		if (filterMatch) {
			filter = parseDueFilter(filterMatch[1] ?? '');
			continue;
		}

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

	return { filter, folders };
}

function parseDueFilter(value: string): ParsedDueFilter {
	const normalized = value.trim().toLowerCase().replace(/\s+/g, '');
	const todayMatch = normalized.match(/^today(?:\+(\d+|n))?$/);

	if (todayMatch) {
		const offset = todayMatch[1] && todayMatch[1] !== 'n'
			? Number(todayMatch[1])
			: 0;
		return { filter: 'today-plus-n', todayOffset: offset };
	}

	if (normalized === 'this-week' || normalized === 'thisweek') {
		return { filter: 'this-week', todayOffset: 0 };
	}

	if (normalized === 'this-month' || normalized === 'thismonth') {
		return { filter: 'this-month', todayOffset: 0 };
	}

	return { filter: 'all', todayOffset: 0 };
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
