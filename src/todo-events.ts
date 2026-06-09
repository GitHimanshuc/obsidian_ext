import type { TodoMatch } from './todo-types';

type CompletionListener = (task: TodoMatch) => void;

const completionListeners = new Set<CompletionListener>();

export function emitTodoCompleted(task: TodoMatch): void {
	for (const listener of completionListeners) {
		listener(task);
	}
}

export function onTodoCompleted(listener: CompletionListener): () => void {
	completionListeners.add(listener);
	return () => {
		completionListeners.delete(listener);
	};
}
