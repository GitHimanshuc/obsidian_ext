import {
	App,
	debounce,
	normalizePath,
	PluginSettingTab,
	Setting,
} from 'obsidian';
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
	private saveSettingsDebounced: () => void;

	constructor(app: App, plugin: TodoPlugin) {
		super(app, plugin);
		this.plugin = plugin;
		this.saveSettingsDebounced = debounce(
			() => {
				void this.plugin.saveSettings();
			},
			500,
			true,
		);
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		const foldersSetting = new Setting(containerEl)
			.setName('Folders to scan')
			.setDesc('One vault-relative folder path per line.')
			.addTextArea((text) =>
				text
					.setPlaceholder('Days')
					.setValue(this.plugin.settings.scanFolders.join('\n'))
					.onChange((value) => {
						const scanFolders = normalizeScanFoldersInput(value);
						if (scanFolders.length === 0) {
							foldersSetting.setDesc(
								'Enter at least one vault-relative folder path.',
							);
							return;
						}

						foldersSetting.setDesc('One vault-relative folder path per line.');
						this.plugin.settings.scanFolders = scanFolders;
						this.saveSettingsDebounced();
					}),
			);

		const outputSetting = new Setting(containerEl)
			.setName('Output file')
			.setDesc('Vault-relative Markdown file to overwrite with collected todos.')
			.addText((text) =>
				text
					.setPlaceholder('Days/TODO.md')
					.setValue(this.plugin.settings.outputFile)
					.onChange((value) => {
						const outputFile = normalizeOutputFileInput(value);
						if (!outputFile) {
							outputSetting.setDesc(
								'Enter a vault-relative Markdown file ending in .md.',
							);
							return;
						}

						outputSetting.setDesc(
							'Vault-relative Markdown file to overwrite with collected todos.',
						);
						this.plugin.settings.outputFile = outputFile;
						this.saveSettingsDebounced();
					}),
			);
	}
}

function normalizeScanFoldersInput(value: string): string[] {
	return value
		.split(/\r?\n/)
		.map((folder) => normalizeFolderPath(folder))
		.filter(Boolean);
}

function normalizeOutputFileInput(value: string): string | null {
	const normalized = normalizePath(value.trim()).replace(/^\/+/, '');
	if (!normalized || !normalized.toLowerCase().endsWith('.md')) {
		return null;
	}

	return normalized;
}

function normalizeFolderPath(folder: string): string {
	return normalizePath(folder.trim()).replace(/^\/+|\/+$/g, '');
}
