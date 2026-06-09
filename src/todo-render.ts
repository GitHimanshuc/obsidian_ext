import {
	App,
	debounce,
	MarkdownPostProcessorContext,
	MarkdownRenderChild,
} from 'obsidian';
import { completeSourceTask } from './todo-completion';
import {
	formatOptionalDateTime,
	getDateTimeTimestamp,
	getTodayDate,
} from './todo-date';
import { emitTodoCompleted, onTodoCompleted } from './todo-events';
import {
	getDueFilterBounds,
	getTodayOffset,
	matchesDueFilter,
} from './todo-filter';
import { getBlockOptions, normalizeOutputFile } from './todo-options';
import { collectTodos, sortTodos } from './todo-scan';
import type { TodoPluginSettings } from './settings';
import type {
	DisplayField,
	DueFilter,
	DueFilterOption,
	TodoSort,
	TodoSortOption,
	TodoMatch,
} from './todo-types';

const DUE_FILTERS: DueFilterOption[] = [
	{ id: 'all', label: 'All' },
	{ id: 'today', label: 'Today' },
	{ id: 'today-plus-n', label: 'Today + N' },
	{ id: 'this-week', label: 'This week' },
	{ id: 'this-month', label: 'This month' },
];

const SORT_OPTIONS: TodoSortOption[] = [
	{ id: 'due', label: 'Due time' },
	{ id: 'prio', label: 'Priority' },
	{ id: 'est', label: 'Completion time' },
	{ id: 'effective-prio', label: 'Effective priority' },
	{ id: 'done', label: 'Completed time' },
];

export async function renderTodoBlock(
	app: App,
	settings: TodoPluginSettings,
	source: string,
	el: HTMLElement,
	ctx?: MarkdownPostProcessorContext,
): Promise<void> {
	el.empty();
	el.addClass('todo-plugin-view');

	const blockOptions = getBlockOptions(source, settings);
	const outputFile = normalizeOutputFile(settings.outputFile);
	let tasks = await collectTodos(
		app,
		blockOptions.scanFolders,
		outputFile,
		blockOptions.mode === 'completed-today' ? 'completed' : 'active',
	);
	let activeFilter = blockOptions.filter;
	let activeSort = getValidSort(blockOptions.sort, blockOptions.mode);

	const controlsEl = el.createDiv();
	let filterEl: HTMLSelectElement | null = null;
	let offsetEl: HTMLInputElement | null = null;

	if (blockOptions.mode === 'active') {
		filterEl = controlsEl.createEl('select');
		for (const filter of DUE_FILTERS) {
			filterEl.createEl('option', {
				text: filter.label,
				value: filter.id,
			});
		}
		filterEl.value = activeFilter;
	}

	const sortEl = controlsEl.createEl('select');
	for (const sort of getSortOptions(blockOptions.mode)) {
		sortEl.createEl('option', {
			text: sort.label,
			value: sort.id,
		});
	}
	sortEl.value = activeSort;

	if (blockOptions.mode === 'active') {
		offsetEl = controlsEl.createEl('input', {
			type: 'number',
			value: String(blockOptions.todayOffset),
		});
		offsetEl.min = '0';
		offsetEl.step = '1';
		offsetEl.inputMode = 'numeric';
		offsetEl.ariaLabel = 'Days from today';
	}

	const listRootEl = el.createDiv();
	const renderList = () => {
		const today = getTodayDate();
		const todayOffset = offsetEl ? getTodayOffset(offsetEl) : 0;
		const dueFilterBounds = getDueFilterBounds(activeFilter, today, todayOffset);
		const visibleTasks = sortTodos(getVisibleTasks(
			tasks,
			blockOptions.mode,
			dueFilterBounds,
			today,
		), activeSort);

		if (offsetEl) {
			offsetEl.style.display = activeFilter === 'today-plus-n' ? '' : 'none';
		}

		listRootEl.empty();
		if (visibleTasks.length === 0) {
			listRootEl.createEl('p', { text: 'No matching todos found.' });
			return;
		}

		const listEl = listRootEl.createEl('ul');
		for (const task of visibleTasks) {
			const itemEl = listEl.createEl('li');
			const checkboxEl = blockOptions.mode === 'active'
				? itemEl.createEl('input', { type: 'checkbox' })
				: null;
			checkboxEl?.addClass('task-list-item-checkbox');

			renderTaskFields(
				itemEl,
				task,
				blockOptions.displayFields,
				app,
				outputFile,
			);

			checkboxEl?.addEventListener('change', () => {
				checkboxEl.disabled = true;
				void completeSourceTask(app, task)
					.then((completedTask) => {
						if (completedTask) {
							tasks = tasks.filter((candidate) => candidate !== task);
							emitTodoCompleted(completedTask);
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

	filterEl?.addEventListener('change', () => {
		activeFilter = filterEl.value as DueFilter;
		renderList();
	});
	sortEl.addEventListener('change', () => {
		activeSort = sortEl.value as TodoSort;
		renderList();
	});
	const renderListDebounced = debounce(renderList, 150, true);
	offsetEl?.addEventListener('input', () => {
		renderListDebounced();
	});

	if (ctx) {
		const renderChild = new MarkdownRenderChild(el);
		renderChild.register(
			onTodoCompleted((task) => {
				if (!isTaskInScanFolders(task, blockOptions.scanFolders)) {
					return;
				}

				if (blockOptions.mode === 'active') {
					const nextTasks = tasks.filter(
						(candidate) => !isSameSourceTask(candidate, task),
					);
					if (nextTasks.length !== tasks.length) {
						tasks = nextTasks;
						renderList();
					}
					return;
				}

				if (
					task.completedDate === getTodayDate() &&
					!tasks.some((candidate) => isSameSourceTask(candidate, task))
				) {
					tasks = [...tasks, task];
					renderList();
				}
			}),
		);
		ctx.addChild(renderChild);
	}

	renderList();
}

function getVisibleTasks(
	tasks: TodoMatch[],
	mode: 'active' | 'completed-today',
	dueFilterBounds: ReturnType<typeof getDueFilterBounds>,
	today: string,
): TodoMatch[] {
	if (mode === 'completed-today') {
		return tasks.filter((task) => task.completedDate === today);
	}

	return tasks.filter((task) => matchesDueFilter(task, dueFilterBounds));
}

function getSortOptions(mode: 'active' | 'completed-today'): TodoSortOption[] {
	return mode === 'completed-today'
		? SORT_OPTIONS
		: SORT_OPTIONS.filter((sort) => sort.id !== 'done');
}

function getValidSort(
	sort: TodoSort,
	mode: 'active' | 'completed-today',
): TodoSort {
	const sortOptions = getSortOptions(mode);
	return sortOptions.some((option) => option.id === sort)
		? sort
		: mode === 'completed-today'
			? 'done'
			: 'due';
}

function isTaskInScanFolders(task: TodoMatch, scanFolders: string[]): boolean {
	return scanFolders.some(
		(folder) =>
			task.sourcePath === folder || task.sourcePath.startsWith(`${folder}/`),
	);
}

function isSameSourceTask(left: TodoMatch, right: TodoMatch): boolean {
	return left.sourcePath === right.sourcePath && left.lineNumber === right.lineNumber;
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
			renderSourceLink(itemEl, task.sourcePath, task, app, outputFile);
			continue;
		}

		if (field === 'task') {
			renderSourceLink(itemEl, task.text, task, app, outputFile);
			continue;
		}

		itemEl.createSpan({ text: getDisplayFieldText(task, field) });
	}

	itemEl.createSpan({ text: ' ' });
}

function renderSourceLink(
	itemEl: HTMLLIElement,
	text: string,
	task: TodoMatch,
	app: App,
	outputFile: string,
): void {
	const linkEl = itemEl.createEl('a', { text });
	linkEl.href = '#';
	linkEl.addEventListener('click', (event) => {
		event.preventDefault();
		void app.workspace.openLinkText(
			task.sourcePath.replace(/\.md$/i, ''),
			outputFile,
			false,
			{ eState: { line: task.lineNumber } },
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

	if (field === 'due-hours') {
		return formatDueHours(task);
	}

	if (field === 'made') {
		return `made ${formatOptionalDateTime(task.addedDate, task.addedTime)}`;
	}

	if (field === 'done') {
		return `done ${formatOptionalDateTime(
			task.completedDate,
			task.completedTime,
		)}`;
	}

	if (field === 'prio') {
		return `p${task.priority ?? '-'}`;
	}

	return task.estimateMinutes ? `${task.estimateMinutes}m` : 'est -';
}

function formatDueHours(task: TodoMatch): string {
	const dueTimestamp = getDateTimeTimestamp(task.dueDate, task.dueTime, '23:59');
	if (dueTimestamp === null) {
		return 'due -';
	}

	const hoursUntilDue = (dueTimestamp - Date.now()) / (60 * 60 * 1000);
	const absHours = Math.abs(hoursUntilDue);
	const roundedHours = absHours < 1 ? '<1' : String(Math.ceil(absHours));
	return hoursUntilDue < 0
		? `overdue ${roundedHours}h`
		: `due ${roundedHours}h`;
}
