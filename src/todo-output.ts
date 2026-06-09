import { App, TFile, TFolder } from 'obsidian';
import type { TodoPluginSettings } from './settings';
import { normalizeOutputFile, normalizeScanFolders } from './todo-options';

export async function refreshTodoIndex(
	app: App,
	settings: TodoPluginSettings,
): Promise<void> {
	const scanFolders = normalizeScanFolders(settings.scanFolders);
	const outputFile = normalizeOutputFile(settings.outputFile);

	await writeOutputFile(outputFile, renderTodoIndex(scanFolders), app);
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
