import { Notice, Plugin } from 'obsidian';
import {
	DEFAULT_SETTINGS,
	TodoPluginSettings,
	TodoSettingTab,
} from './settings';
import {
	getTodoTaskTemplate,
	refreshTodoIndex,
	renderTodoBlock,
} from './todo-index';

export default class TodoPlugin extends Plugin {
	settings!: TodoPluginSettings;

	async onload() {
		await this.loadSettings();

		this.addCommand({
			id: 'refresh-todo-index',
			name: 'Refresh todo index',
			callback: async () => {
				await this.refreshTodoIndex();
			},
		});

		this.addCommand({
			id: 'insert-todo-task-template',
			name: 'Insert todo task template',
			editorCallback: (editor) => {
				editor.replaceSelection(getTodoTaskTemplate());
			},
		});

		this.addSettingTab(new TodoSettingTab(this.app, this));

		this.registerMarkdownCodeBlockProcessor(
			'todo-plugin',
			async (source, el, ctx) => {
				try {
					await renderTodoBlock(this.app, this.settings, source, el, ctx);
				} catch (error) {
					el.empty();
					el.addClass('todo-plugin-view');
					el.createEl('p', { text: getErrorMessage(error) });
					console.error('Failed to render todo block', error);
				}
			},
		);
	}

	onunload() {}

	async refreshTodoIndex() {
		try {
			await refreshTodoIndex(this.app, this.settings);
		} catch (error) {
			console.error('Failed to refresh todo index', error);
			new Notice(`Todo Plugin: ${getErrorMessage(error)}`);
		}
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<TodoPluginSettings>,
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : 'An unexpected error occurred.';
}
