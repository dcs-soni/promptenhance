import * as fs from 'fs/promises';
import * as path from 'path';
import { homedir } from 'os';

export interface UserConfig {
  openaiApiKey?: string;
  chromaServerUrl?: string;
  chromaAuthToken?: string;
  chromaTenant?: string;
  chromaDatabase?: string;
}

export interface ConfigOptions {
  openaiKey?: string;
  chromaUrl?: string;
  chromaToken?: string;
  chromaTenant?: string;
  chromaDb?: string;
}

export class ConfigManager {
  private static CONFIG_DIR = path.join(homedir(), '.promptenhance');
  private static CONFIG_FILE = path.join(
    ConfigManager.CONFIG_DIR,
    'config.json'
  );

  // Load configuration with priority: CLI flags > Environment variables > Config file

  static async load(cliOptions: ConfigOptions = {}): Promise<UserConfig> {
    // Start with config file
    const fileConfig = await this.loadFromFile();

    // Override with environment variables
    const envConfig: UserConfig = {
      openaiApiKey: process.env.OPENAI_API_KEY || fileConfig.openaiApiKey,
      chromaServerUrl:
        process.env.CHROMA_SERVER_URL || fileConfig.chromaServerUrl,
      chromaAuthToken:
        process.env.CHROMA_AUTH_TOKEN || fileConfig.chromaAuthToken,
      chromaTenant: process.env.CHROMA_TENANT || fileConfig.chromaTenant,
      chromaDatabase: process.env.CHROMA_DATABASE || fileConfig.chromaDatabase,
    };

    // Override with CLI flags (highest priority)
    const finalConfig: UserConfig = {
      openaiApiKey: cliOptions.openaiKey || envConfig.openaiApiKey,
      chromaServerUrl: cliOptions.chromaUrl || envConfig.chromaServerUrl,
      chromaAuthToken: cliOptions.chromaToken || envConfig.chromaAuthToken,
      chromaTenant: cliOptions.chromaTenant || envConfig.chromaTenant,
      chromaDatabase: cliOptions.chromaDb || envConfig.chromaDatabase,
    };

    return finalConfig;
  }

  // Load config from ~/.promptenhance/config.json

  private static async loadFromFile(): Promise<UserConfig> {
    try {
      const exists = await fs
        .access(this.CONFIG_FILE)
        .then(() => true)
        .catch(() => false);
      if (!exists) {
        return {};
      }

      const content = await fs.readFile(this.CONFIG_FILE, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      return {};
    }
  }

  //   Save config to ~/.promptenhance/config.json

  static async save(config: UserConfig): Promise<void> {
    await fs.mkdir(this.CONFIG_DIR, { recursive: true });

    const existingConfig = await this.loadFromFile();

    // Merge with new config (only update provided fields)
    const mergedConfig = {
      ...existingConfig,
      ...Object.fromEntries(
        Object.entries(config).filter(([_, v]) => v !== undefined)
      ),
    };

    await fs.writeFile(
      this.CONFIG_FILE,
      JSON.stringify(mergedConfig, null, 2),
      'utf-8'
    );
  }

  static async get(key: keyof UserConfig): Promise<string | undefined> {
    const config = await this.loadFromFile();
    return config[key];
  }

  // Remove a specific config value

  static async unset(key: keyof UserConfig): Promise<void> {
    const config = await this.loadFromFile();
    delete config[key];
    await fs.writeFile(
      this.CONFIG_FILE,
      JSON.stringify(config, null, 2),
      'utf-8'
    );
  }

  static async exists(): Promise<boolean> {
    return fs
      .access(this.CONFIG_FILE)
      .then(() => true)
      .catch(() => false);
  }

  static getConfigPath(): string {
    return this.CONFIG_FILE;
  }

  static async display(): Promise<UserConfig> {
    const config = await this.load();
    return {
      openaiApiKey: config.openaiApiKey
        ? this.maskSecret(config.openaiApiKey)
        : undefined,
      chromaServerUrl: config.chromaServerUrl,
      chromaAuthToken: config.chromaAuthToken
        ? this.maskSecret(config.chromaAuthToken)
        : undefined,
      chromaTenant: config.chromaTenant,
      chromaDatabase: config.chromaDatabase,
    };
  }

  private static maskSecret(value: string): string {
    if (value.length <= 8) {
      return '***';
    }
    return value.substring(0, 4) + '***' + value.substring(value.length - 4);
  }
}
