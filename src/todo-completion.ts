import { App, TFile } from 'obsidian';
import { getCurrentDateTime } from './todo-date';
import { parseTodoLine } from './todo-parser';
import type { TodoMatch } from './todo-types';

const UNCHECKED_TASK_MARKER = /^(\s*- \[) \]/;

export async function completeSourceTask(
	app: App,
	task: TodoMatch,
): Promise<TodoMatch | null> {
	const sourceFile = app.vault.getAbstractFileByPath(task.sourcePath);

	if (!(sourceFile instanceof TFile)) {
		return null;
	}

	let completedTask: TodoMatch | null = null;

	await app.vault.process(sourceFile, (data) => {
		const completedAt = getCurrentDateTime();
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

		const completedLine = setDoneMetadata(
			sourceLine.replace(UNCHECKED_TASK_MARKER, '$1x]'),
			completedAt.date,
			completedAt.time,
		);
		const parsedTask = parseTodoLine(completedLine.trimStart());
		if (!parsedTask) {
			return data;
		}

		lines[lineIndex] = completedLine;
		completedTask = {
			addedDate: parsedTask.addedDate,
			addedTime: parsedTask.addedTime,
			completed: true,
			completedDate: completedAt.date,
			completedTime: completedAt.time,
			dueDate: parsedTask.dueDate,
			dueTime: parsedTask.dueTime,
			estimateMinutes: parsedTask.estimateMinutes,
			lineNumber: lineIndex,
			priority: parsedTask.priority,
			sourcePath: task.sourcePath,
			sourceLine: completedLine,
			text: parsedTask.text,
		};
		return lines.join(lineEnding);
	});

	return completedTask;
}

function setDoneMetadata(line: string, date: string, time: string): string {
	const doneValue = `done:${date} ${time}`;
	const separatorIndex = line.indexOf('@@');
	if (separatorIndex === -1) {
		return `${line} @@ ${doneValue}`;
	}

	const beforeMetadata = line.slice(0, separatorIndex + 2);
	const metadata = line.slice(separatorIndex + 2).trim();
	if (!metadata) {
		return `${beforeMetadata} ${doneValue}`;
	}

	const parts = metadata.split(',').map((part) => part.trim()).filter(Boolean);
	const doneIndex = parts.findIndex((part) =>
		/^(done|completed)\s*:/i.test(part),
	);

	if (doneIndex === -1) {
		parts.push(doneValue);
	} else {
		parts[doneIndex] = doneValue;
	}

	return `${beforeMetadata} ${parts.join(', ')}`;
}

function findSourceLine(lines: string[], task: TodoMatch): number {
	if (lines[task.lineNumber] === task.sourceLine) {
		return task.lineNumber;
	}

	const exactMatches = findLineIndexes(lines, (line) => line === task.sourceLine);
	if (exactMatches.length === 1) {
		return exactMatches[0] ?? -1;
	}

	const trimmedMatches = findLineIndexes(
		lines,
		(line) => line.trimStart() === task.sourceLine.trimStart(),
	);
	return trimmedMatches.length === 1 ? trimmedMatches[0] ?? -1 : -1;
}

function findLineIndexes(
	lines: string[],
	predicate: (line: string) => boolean,
): number[] {
	const matches: number[] = [];
	for (const [index, line] of lines.entries()) {
		if (predicate(line)) {
			matches.push(index);
		}
	}

	return matches;
}
