import { App, normalizePath, TAbstractFile, TFile, TFolder } from 'obsidian';
import type { TodoPluginSettings } from './settings';

const TASK_PATTERN = /^\s*- \[ \]\s+(.+)$/;
const TASK_METADATA_SEPARATOR = '@@';
const UNCHECKED_TASK_MARKER = /^(\s*- \[) \]/;

type DueFilter = 'all' | 'today-plus-n' | 'this-week' | 'this-month';
type DisplayField = 'task' | 'due' | 'made' | 'prio' | 'est' | 'source';

interface TodoMatch {
	addedDate: string | null;
	addedTime: string | null;
	dueDate: string | null;
	dueTime: string | null;
	estimateMinutes: number | null;
	line: string;
	lineNumber: number;
	priority: number | null;
	sourcePath: string;
	sourceLine: string;
	text: string;
}

interface ParsedTodoLine {
	addedDate: string | null;
	addedTime: string | null;
	dueDate: string | null;
	dueTime: string | null;
	estimateMinutes: number | null;
	text: string;
	priority: number | null;
}

interface DueFilterOption {
	id: DueFilter;
	label: string;
}

interface TodoBlockOptions {
	displayFields: DisplayField[];
	filter: DueFilter;
	scanFolders: string[];
	todayOffset: number;
}

interface ParsedDueFilter {
	filter: DueFilter;
	todayOffset: number;
}

interface ParsedTodoBlock {
	displayFields: DisplayField[];
	filter: ParsedDueFilter | null;
	folders: string[];
}

const DEFAULT_DISPLAY_FIELDS: DisplayField[] = [
	'task',
	'due',
	'prio',
	'est',
	'source',
];

const DUE_FILTERS: DueFilterOption[] = [
	{ id: 'all', label: 'All' },
	{ id: 'today-plus-n', label: 'Today + N' },
	{ id: 'this-week', label: 'This week' },
	{ id: 'this-month', label: 'This month' },
];

export function getTodoTaskTemplate(date = new Date()): string {
	const today = formatDateOnly(date);
	return [
		'- [ ] TODO @@',
		`add:${today} ${formatTimeOnly(date)},`,
		`due:${today} 17:00,`,
		'prio:1,',
		'est:30',
	].join(' ');
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

			renderTaskFields(
				itemEl,
				task,
				blockOptions.displayFields,
				app,
				outputFile,
			);

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
		const leftDueDateTime = getDueDateTimeSortValue(left);
		const rightDueDateTime = getDueDateTimeSortValue(right);
		return (
			leftDueDateTime.localeCompare(rightDueDateTime) ||
			(right.priority ?? 0) - (left.priority ?? 0) ||
			left.sourcePath.localeCompare(right.sourcePath) ||
			left.lineNumber - right.lineNumber
		);
	});
}

function getDueDateTimeSortValue(task: TodoMatch): string {
	if (!task.dueDate) {
		return '9999-12-31 99:99';
	}

	return `${task.dueDate} ${task.dueTime ?? '99:99'}`;
}

function renderTaskFields(
	itemEl: HTMLLIElement,
	task: TodoMatch,
	displayFields: DisplayField[],
	app: App,
	outputFile: string,
): void {
	itemEl.createSpan({ text: ' ' });

	for (const [index, field] of displayFields.entries()) {
		if (index > 0) {
			itemEl.createSpan({ text: ' · ' });
		}

		if (field === 'source') {
			renderSourceLink(itemEl, task.sourcePath, task.sourcePath, app, outputFile);
			continue;
		}

		if (field === 'task') {
			renderSourceLink(itemEl, task.text, task.sourcePath, app, outputFile);
			continue;
		}

		itemEl.createSpan({ text: getDisplayFieldText(task, field) });
	}

	itemEl.createSpan({ text: ' ' });
}

function renderSourceLink(
	itemEl: HTMLLIElement,
	text: string,
	sourcePath: string,
	app: App,
	outputFile: string,
): void {
	const linkEl = itemEl.createEl('a', { text });
	linkEl.href = '#';
	linkEl.addEventListener('click', (event) => {
		event.preventDefault();
		void app.workspace.openLinkText(
			sourcePath.replace(/\.md$/i, ''),
			outputFile,
		);
	});
}

function getDisplayFieldText(task: TodoMatch, field: DisplayField): string {
	if (field === 'task') {
		return task.text;
	}

	if (field === 'due') {
		return formatOptionalDateTime(task.dueDate, task.dueTime);
	}

	if (field === 'made') {
		return `made ${formatOptionalDateTime(task.addedDate, task.addedTime)}`;
	}

	if (field === 'prio') {
		return `p${task.priority ?? '-'}`;
	}

	return task.estimateMinutes ? `${task.estimateMinutes}m` : 'est -';
}

function formatOptionalDateTime(
	date: string | null,
	time: string | null,
): string {
	if (!date) {
		return '-';
	}

	return time ? `${date} ${time}` : date;
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

function formatTimeOnly(date: Date): string {
	const hours = String(date.getHours()).padStart(2, '0');
	const minutes = String(date.getMinutes()).padStart(2, '0');
	return `${hours}:${minutes}`;
}

function isValidDateOnly(value: string): boolean {
	const date = parseDateOnly(value);
	return formatDateOnly(date) === value;
}

function parseTodoLine(line: string): ParsedTodoLine | null {
	const taskMatch = line.match(TASK_PATTERN);
	if (!taskMatch) {
		return null;
	}

	const body = taskMatch[1]?.trim();
	if (!body) {
		return null;
	}

	const separatorIndex = body.indexOf(TASK_METADATA_SEPARATOR);
	if (separatorIndex === -1) {
		return null;
	}

	const text = body.slice(0, separatorIndex).trim();
	if (!text) {
		return null;
	}

	const metadata = parseTaskMetadata(
		body.slice(separatorIndex + TASK_METADATA_SEPARATOR.length),
	);

	return { ...metadata, text };
}

function parseTaskMetadata(
	rawMetadata: string,
): Omit<ParsedTodoLine, 'text'> {
	const metadata: Omit<ParsedTodoLine, 'text'> = {
		addedDate: null,
		addedTime: null,
		dueDate: null,
		dueTime: null,
		estimateMinutes: null,
		priority: null,
	};

	for (const rawPart of rawMetadata.split(',')) {
		const part = rawPart.trim();
		if (!part) {
			continue;
		}

		const fieldMatch = part.match(/^([a-z]+)\s*:\s*(.+)$/i);
		if (!fieldMatch) {
			continue;
		}

		const key = fieldMatch[1]?.toLowerCase();
		const value = fieldMatch[2]?.trim();
		if (!key || !value) {
			continue;
		}

		if (key === 'add' || key === 'added') {
			const dateTime = parseDateTime(value);
			if (dateTime) {
				metadata.addedDate = dateTime.date;
				metadata.addedTime = dateTime.time;
			}
			continue;
		}

		if (key === 'due') {
			const dateTime = parseDateTime(value);
			if (dateTime) {
				metadata.dueDate = dateTime.date;
				metadata.dueTime = dateTime.time;
			}
			continue;
		}

		if (key === 'prio' || key === 'priority') {
			metadata.priority = parseIntegerInRange(value, 1, 100);
			continue;
		}

		if (key === 'est' || key === 'estimate') {
			metadata.estimateMinutes = parseEstimateMinutes(value);
		}
	}

	return metadata;
}

function parseDateTime(value: string): { date: string; time: string | null } | null {
	const match = value
		.trim()
		.match(/^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}))?$/);
	const date = match?.[1];
	const time = match?.[2] ?? null;

	if (!date || !isValidDateOnly(date)) {
		return null;
	}

	if (time && !isValidTimeOnly(time)) {
		return null;
	}

	return { date, time };
}

function isValidTimeOnly(value: string): boolean {
	const match = value.match(/^(\d{2}):(\d{2})$/);
	const hours = Number(match?.[1]);
	const minutes = Number(match?.[2]);
	return (
		Number.isInteger(hours) &&
		Number.isInteger(minutes) &&
		hours >= 0 &&
		hours <= 23 &&
		minutes >= 0 &&
		minutes <= 59
	);
}

function parseIntegerInRange(
	value: string,
	minimum: number,
	maximum: number,
): number | null {
	const number = Number(value.trim());
	if (!Number.isInteger(number) || number < minimum || number > maximum) {
		return null;
	}

	return number;
}

function parseEstimateMinutes(value: string): number | null {
	const match = value.trim().match(/^(\d+)(?:\s*m(?:in(?:s)?)?)?$/i);
	const minutes = Number(match?.[1]);
	if (!Number.isInteger(minutes) || minutes <= 0) {
		return null;
	}

	return minutes;
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
			const normalizedLine = line.trimStart();
			const parsedTask = parseTodoLine(normalizedLine);
			if (!parsedTask) {
				continue;
			}

			tasks.push({
				addedDate: parsedTask.addedDate,
				addedTime: parsedTask.addedTime,
				dueDate: parsedTask.dueDate,
				dueTime: parsedTask.dueTime,
				estimateMinutes: parsedTask.estimateMinutes,
				line: normalizedLine,
				lineNumber,
				priority: parsedTask.priority,
				sourcePath: file.path,
				sourceLine: line,
				text: parsedTask.text,
			});
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
		displayFields: block.displayFields,
		filter: block.filter?.filter ?? 'all',
		scanFolders: normalizeScanFolders(
			block.folders.length > 0 ? block.folders : settings.scanFolders,
		),
		todayOffset: block.filter?.todayOffset ?? 0,
	};
}

function parseTodoBlock(source: string): ParsedTodoBlock {
	let displayFields: DisplayField[] = DEFAULT_DISPLAY_FIELDS;
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

		const displayMatch = line.match(/^display\s*:\s*(.*)$/i);
		if (displayMatch) {
			displayFields = parseDisplayFields(displayMatch[1] ?? '');
			continue;
		}

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

	return { displayFields, filter, folders };
}

function parseDisplayFields(value: string): DisplayField[] {
	const fields = value
		.split(',')
		.map((field) => parseDisplayField(field))
		.filter((field): field is DisplayField => field !== null);

	return fields.length > 0 ? fields : DEFAULT_DISPLAY_FIELDS;
}

function parseDisplayField(value: string): DisplayField | null {
	const normalized = value.trim().toLowerCase();

	if (normalized === 'task' || normalized === 'text') {
		return 'task';
	}

	if (normalized === 'due') {
		return 'due';
	}

	if (
		normalized === 'made' ||
		normalized === 'add' ||
		normalized === 'added'
	) {
		return 'made';
	}

	if (normalized === 'prio' || normalized === 'priority') {
		return 'prio';
	}

	if (
		normalized === 'est' ||
		normalized === 'estimate' ||
		normalized === 'estimated'
	) {
		return 'est';
	}

	if (normalized === 'source' || normalized === 'file') {
		return 'source';
	}

	return null;
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
