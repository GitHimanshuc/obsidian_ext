import { isValidDateOnly } from './todo-date';
import type { ParsedTodoLine } from './todo-types';

const TASK_PATTERN = /^\s*- \[ \]\s+(.+)$/;
const TASK_LINE_PATTERN = /^\s*- \[([^\]])\]\s+(.+)$/;
const TASK_METADATA_SEPARATOR = '@@';

export function parseTodoLine(line: string): ParsedTodoLine | null {
	const taskMatch = line.match(TASK_LINE_PATTERN);
	if (!taskMatch) {
		return null;
	}

	const taskMarker = taskMatch[1] ?? '';
	const body = taskMatch[2]?.trim();
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

	return { ...metadata, completed: taskMarker !== ' ', text };
}

export function parseActiveTodoLine(line: string): ParsedTodoLine | null {
	if (!TASK_PATTERN.test(line)) {
		return null;
	}

	return parseTodoLine(line);
}

function parseTaskMetadata(
	rawMetadata: string,
): Omit<ParsedTodoLine, 'text'> {
	const metadata: Omit<ParsedTodoLine, 'text'> = {
		addedDate: null,
		addedTime: null,
		completed: false,
		completedDate: null,
		completedTime: null,
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

		if (key === 'done' || key === 'completed') {
			const dateTime = parseDateTime(value);
			if (dateTime) {
				metadata.completedDate = dateTime.date;
				metadata.completedTime = dateTime.time;
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
