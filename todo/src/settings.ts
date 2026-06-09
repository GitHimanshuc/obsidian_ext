import { App, PluginSettingTab, Setting } from 'obsidian';
import type TodoPlugin from './main';

export interface TodoPluginSettings {
	scanFolders: string[];
	outputFile: string;
}

export const DEFAULT_SETTINGS: TodoPluginSettings = {
	scanFolders: ['Days'],
	outputFile: 'Days/TODO.md',
};

export class TodoSettingTab extends PluginSettingTab {
	plugin: TodoPlugin;

	constructor(app: App, plugin: TodoPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Folders to scan')
			.setDesc('One vault-relative folder path per line.')
			.addTextArea((text) =>
				text
					.setPlaceholder('Days')
					.setValue(this.plugin.settings.scanFolders.join('\n'))
					.onChange(async (value) => {
						this.plugin.settings.scanFolders = value
							.split(/\r?\n/)
							.map((folder) => folder.trim())
							.filter(Boolean);
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Output file')
			.setDesc('Vault-relative Markdown file to overwrite with collected todos.')
			.addText((text) =>
				text
					.setPlaceholder('Days/TODO.md')
					.setValue(this.plugin.settings.outputFile)
					.onChange(async (value) => {
						this.plugin.settings.outputFile = value.trim();
						await this.plugin.saveSettings();
					}),
			);
	}
}
