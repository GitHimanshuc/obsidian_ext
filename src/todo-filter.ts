import { addDays, endOfMonth } from './todo-date';
import type { DueFilter, DueFilterBounds, TodoMatch } from './todo-types';

export function matchesDueFilter(
	task: TodoMatch,
	bounds: DueFilterBounds,
): boolean {
	if (bounds.filter === 'all') {
		return true;
	}

	if (!task.dueDate) {
		return true;
	}

	if (bounds.exactDate) {
		return task.dueDate === bounds.exactDate;
	}

	return (
		(!bounds.startDate || task.dueDate >= bounds.startDate) &&
		(!bounds.endDate || task.dueDate <= bounds.endDate)
	);
}

export function getDueFilterBounds(
	filter: DueFilter,
	today: string,
	todayOffset: number,
): DueFilterBounds {
	if (filter === 'today') {
		return {
			endDate: null,
			exactDate: today,
			filter,
			startDate: null,
		};
	}

	if (filter === 'today-plus-n') {
		return {
			endDate: null,
			exactDate: addDays(today, todayOffset),
			filter,
			startDate: null,
		};
	}

	if (filter === 'this-week') {
		return {
			endDate: addDays(today, 6),
			exactDate: null,
			filter,
			startDate: today,
		};
	}

	if (filter === 'this-month') {
		return {
			endDate: endOfMonth(today),
			exactDate: null,
			filter,
			startDate: today,
		};
	}

	return { endDate: null, exactDate: null, filter, startDate: null };
}

export function getTodayOffset(inputEl: HTMLInputElement): number {
	const offset = Number(inputEl.value);
	if (!Number.isFinite(offset) || offset < 0) {
		return 0;
	}

	return Math.floor(offset);
}
