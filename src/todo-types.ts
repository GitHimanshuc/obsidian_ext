export type DueFilter =
	| 'all'
	| 'today'
	| 'today-plus-n'
	| 'this-week'
	| 'this-month';
export type DisplayField =
	| 'task'
	| 'due'
	| 'due-hours'
	| 'made'
	| 'prio'
	| 'est'
	| 'source'
	| 'done';
export type TodoMode = 'active' | 'completed-today';
export type TodoSort = 'due' | 'prio' | 'est' | 'effective-prio' | 'done';
export type TodoScanMode = 'active' | 'completed';

export interface TodoMatch {
	addedDate: string | null;
	addedTime: string | null;
	completed: boolean;
	completedDate: string | null;
	completedTime: string | null;
	dueDate: string | null;
	dueTime: string | null;
	estimateMinutes: number | null;
	lineNumber: number;
	priority: number | null;
	sourcePath: string;
	sourceLine: string;
	text: string;
}

export interface ParsedTodoLine {
	addedDate: string | null;
	addedTime: string | null;
	completed: boolean;
	completedDate: string | null;
	completedTime: string | null;
	dueDate: string | null;
	dueTime: string | null;
	estimateMinutes: number | null;
	text: string;
	priority: number | null;
}

export interface DueFilterOption {
	id: DueFilter;
	label: string;
}

export interface TodoSortOption {
	id: TodoSort;
	label: string;
}

export interface DueFilterBounds {
	endDate: string | null;
	exactDate: string | null;
	filter: DueFilter;
	startDate: string | null;
}

export interface TodoBlockOptions {
	displayFields: DisplayField[];
	filter: DueFilter;
	mode: TodoMode;
	scanFolders: string[];
	sort: TodoSort;
	todayOffset: number;
}

export interface ParsedDueFilter {
	filter: DueFilter;
	todayOffset: number;
}

export interface ParsedTodoBlock {
	displayFields: DisplayField[];
	filter: ParsedDueFilter | null;
	folders: string[];
	mode: TodoMode | null;
	sort: TodoSort | null;
}
