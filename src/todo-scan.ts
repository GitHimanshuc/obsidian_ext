import { App, TAbstractFile, TFile, TFolder } from 'obsidian';
import { getDateTimeTimestamp } from './todo-date';
import { parseTodoLine } from './todo-parser';
import type { TodoMatch, TodoScanMode, TodoSort } from './todo-types';

interface TodoFileReadTarget {
	file: TFile;
	lineNumbers: number[] | null;
}

export async function collectTodos(
	app: App,
	scanFolders: string[],
	outputFile: string,
	mode: TodoScanMode = 'active',
): Promise<TodoMatch[]> {
	const readTargets = getMarkdownFilesInFolders(app, scanFolders)
		.filter((file) => file.path !== outputFile)
		.map((file) => getTodoFileReadTarget(app, file, mode))
		.filter((target): target is TodoFileReadTarget => target !== null);

	const taskGroups = await Promise.all(
		readTargets.map(async ({ file, lineNumbers }) =>
			parseTodosInFile(file, await app.vault.cachedRead(file), lineNumbers, mode),
		),
	);

	return taskGroups.flat();
}

export function sortTodos(
	tasks: TodoMatch[],
	sort: TodoSort = 'due',
	now = new Date(),
): TodoMatch[] {
	return tasks
		.map((task) => ({
			sortKey: getSortKey(task, sort, now),
			task,
		}))
		.sort((left, right) => (
			compareSortKeys(left.sortKey, right.sortKey, sort) ||
			left.task.sourcePath.localeCompare(right.task.sourcePath) ||
			left.task.lineNumber - right.task.lineNumber
		))
		.map(({ task }) => task);
}

function getSortKey(task: TodoMatch, sort: TodoSort, now: Date): number {
	if (sort === 'prio') {
		return task.priority ?? 0;
	}

	if (sort === 'est') {
		return task.estimateMinutes ?? Number.MAX_SAFE_INTEGER;
	}

	if (sort === 'effective-prio') {
		return getEffectivePriority(task, now);
	}

	if (sort === 'done') {
		return getDateTimeTimestamp(task.completedDate, task.completedTime, '00:00') ?? 0;
	}

	return getDateTimeTimestamp(
		task.dueDate,
		task.dueTime,
		'23:59',
	) ?? Number.MAX_SAFE_INTEGER;
}

function compareSortKeys(
	left: number,
	right: number,
	sort: TodoSort,
): number {
	if (sort === 'prio' || sort === 'effective-prio' || sort === 'done') {
		return right - left;
	}

	return left - right;
}

function getEffectivePriority(task: TodoMatch, now: Date): number {
	const dueTimestamp = getDateTimeTimestamp(task.dueDate, task.dueTime, '23:59');
	if (dueTimestamp === null) {
		return Number.NEGATIVE_INFINITY;
	}

	const hoursUntilDue = (dueTimestamp - now.getTime()) / (60 * 60 * 1000);
	const basePriority = task.priority ?? 0;
	const base = hoursUntilDue <= 0 ? Math.max(basePriority, 50) : basePriority;
	const divisor = hoursUntilDue <= 0 ? 1 : Math.max(1, Math.min(hoursUntilDue, 168));
	return base + (10 * (task.estimateMinutes ?? 0)) / divisor;
}

function getTodoFileReadTarget(
	app: App,
	file: TFile,
	mode: TodoScanMode,
): TodoFileReadTarget | null {
	const listItems = app.metadataCache.getFileCache(file)?.listItems;
	if (!listItems) {
		return { file, lineNumbers: null };
	}

	const lineNumbers = listItems
		.filter((item) =>
			mode === 'active'
				? item.task === ' '
				: item.task !== undefined && item.task !== ' ',
		)
		.map((item) => item.position.start.line);

	if (lineNumbers.length === 0) {
		return null;
	}

	return { file, lineNumbers };
}

function parseTodosInFile(
	file: TFile,
	content: string,
	lineNumbers: number[] | null,
	mode: TodoScanMode,
): TodoMatch[] {
	const tasks: TodoMatch[] = [];
	const lines = content.split(/\r?\n/);
	const candidateLineNumbers = lineNumbers ?? lines.keys();

	for (const lineNumber of candidateLineNumbers) {
		const line = lines[lineNumber];
		if (line === undefined) {
			continue;
		}

		const parsedTask = parseTodoLine(line.trimStart());
		if (!parsedTask) {
			continue;
		}

		if (mode === 'active' && parsedTask.completed) {
			continue;
		}

		if (mode === 'completed' && !parsedTask.completed) {
			continue;
		}

		tasks.push({
			addedDate: parsedTask.addedDate,
			addedTime: parsedTask.addedTime,
			completed: parsedTask.completed,
			completedDate: parsedTask.completedDate,
			completedTime: parsedTask.completedTime,
			dueDate: parsedTask.dueDate,
			dueTime: parsedTask.dueTime,
			estimateMinutes: parsedTask.estimateMinutes,
			lineNumber,
			priority: parsedTask.priority,
			sourcePath: file.path,
			sourceLine: line,
			text: parsedTask.text,
		});
	}

	return tasks;
}

function getMarkdownFilesInFolders(app: App, scanFolders: string[]): TFile[] {
	const files: TFile[] = [];

	for (const folderPath of scanFolders) {
		const folder = app.vault.getFolderByPath(folderPath);
		if (!folder) {
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
