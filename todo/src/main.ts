import { Plugin } from 'obsidian';
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
			async (source, el) => {
				await renderTodoBlock(this.app, this.settings, source, el);
			},
		);
	}

	onunload() {}

	async refreshTodoIndex() {
		try {
			await refreshTodoIndex(this.app, this.settings);
		} catch (error) {
			console.error('Failed to refresh todo index', error);
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
