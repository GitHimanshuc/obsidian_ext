import { normalizePath } from 'obsidian';
import type {
	DisplayField,
	ParsedDueFilter,
	ParsedTodoBlock,
	TodoBlockOptions,
	TodoMode,
	TodoSort,
} from './todo-types';
import type { TodoPluginSettings } from './settings';

const DEFAULT_DISPLAY_FIELDS: DisplayField[] = [
	'task',
	'due',
	'prio',
	'est',
	'source',
];

export function getBlockOptions(
	source: string,
	settings: TodoPluginSettings,
): TodoBlockOptions {
	const block = parseTodoBlock(source);
	const mode = block.mode ?? 'active';
	return {
		displayFields: block.displayFields,
		filter: block.filter?.filter ?? 'all',
		mode,
		scanFolders: normalizeScanFolders(
			block.folders.length > 0 ? block.folders : settings.scanFolders,
		),
		sort: block.sort ?? getDefaultSort(mode),
		todayOffset: block.filter?.todayOffset ?? 0,
	};
}

export function normalizeScanFolders(scanFolders: string[]): string[] {
	const normalized = scanFolders.map(normalizeFolderPath).filter(Boolean);

	if (normalized.length === 0) {
		throw new Error('Set at least one folder to scan.');
	}

	return normalized;
}

export function normalizeOutputFile(outputFile: string): string {
	const normalized = normalizePath(outputFile.trim()).replace(/^\/+/, '');

	if (!normalized) {
		throw new Error('Set an output file.');
	}

	if (!normalized.toLowerCase().endsWith('.md')) {
		throw new Error('Output file must end in .md.');
	}

	return normalized;
}

function parseTodoBlock(source: string): ParsedTodoBlock {
	let displayFields: DisplayField[] = DEFAULT_DISPLAY_FIELDS;
	const folders: string[] = [];
	let filter: ParsedDueFilter | null = null;
	let mode: TodoMode | null = null;
	let readingFolderList = false;
	let sort: TodoSort | null = null;

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

		const modeMatch = line.match(/^mode\s*:\s*(.*)$/i);
		if (modeMatch) {
			mode = parseMode(modeMatch[1] ?? '');
			continue;
		}

		const sortMatch = line.match(/^sort\s*:\s*(.*)$/i);
		if (sortMatch) {
			sort = parseSort(sortMatch[1] ?? '');
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

	return { displayFields, filter, folders, mode, sort };
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

	if (
		normalized === 'done' ||
		normalized === 'completed' ||
		normalized === 'completion'
	) {
		return 'done';
	}

	return null;
}

function parseDueFilter(value: string): ParsedDueFilter {
	const normalized = value.trim().toLowerCase().replace(/\s+/g, '');
	if (normalized === 'today') {
		return { filter: 'today', todayOffset: 0 };
	}

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

function normalizeFolderPath(folder: string): string {
	return normalizePath(folder.trim()).replace(/^\/+|\/+$/g, '');
}

function parseMode(value: string): TodoMode | null {
	const normalized = value.trim().toLowerCase().replace(/_/g, '-');
	if (
		normalized === 'completed-today' ||
		normalized === 'completedtoday' ||
		normalized === 'done-today' ||
		normalized === 'donetoday'
	) {
		return 'completed-today';
	}

	if (normalized === 'active' || normalized === 'todo' || normalized === 'open') {
		return 'active';
	}

	return null;
}

function parseSort(value: string): TodoSort | null {
	const normalized = value.trim().toLowerCase().replace(/_/g, '-');
	if (normalized === 'due' || normalized === 'due-time' || normalized === 'time') {
		return 'due';
	}

	if (normalized === 'prio' || normalized === 'priority') {
		return 'prio';
	}

	if (
		normalized === 'est' ||
		normalized === 'estimate' ||
		normalized === 'completion-time'
	) {
		return 'est';
	}

	if (
		normalized === 'effective-prio' ||
		normalized === 'effective-priority' ||
		normalized === 'eff-prio'
	) {
		return 'effective-prio';
	}

	if (normalized === 'done' || normalized === 'completed') {
		return 'done';
	}

	return null;
}

function getDefaultSort(mode: TodoMode): TodoSort {
	return mode === 'completed-today' ? 'done' : 'due';
}
