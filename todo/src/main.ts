import { Notice, Plugin } from 'obsidian';
import {
	DEFAULT_SETTINGS,
	TodoPluginSettings,
	TodoSettingTab,
} from './settings';
import { refreshTodoIndex } from './todo-index';

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

		this.addSettingTab(new TodoSettingTab(this.app, this));
	}

	onunload() {}

	async refreshTodoIndex() {
		try {
			const taskCount = await refreshTodoIndex(this.app, this.settings);
			const suffix = taskCount === 1 ? '' : 's';
			new Notice(`Todo index refreshed: ${taskCount} task${suffix} found.`);
		} catch (error) {
			console.error('Failed to refresh todo index', error);
			const message =
				error instanceof Error ? error.message : 'Failed to refresh todo index.';
			new Notice(message);
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
