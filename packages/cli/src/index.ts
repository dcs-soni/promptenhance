#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { PromptEnhanceAPI } from '@promptenhance/core';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ConfigManager, type ConfigOptions } from './config.js';

const program = new Command();

// Global API instance
let api: PromptEnhanceAPI | null = null;

async function initializeAPI(
  projectPath: string,
  cliOptions: ConfigOptions = {}
): Promise<PromptEnhanceAPI> {
  if (api) return api;

  const spinner = ora('Initializing PromptEnhance...').start();

  try {
    // Load configuration from all sources (file, env, CLI flags)
    const config = await ConfigManager.load(cliOptions);

    api = new PromptEnhanceAPI({
      projectPath,
      embeddingProvider: config.openaiApiKey ? 'openai' : 'mock',
      openaiApiKey: config.openaiApiKey,
      collectionName: `promptenhance-${path.basename(projectPath)}`,
      chromaServerUrl: config.chromaServerUrl,
      chromaAuthToken: config.chromaAuthToken,
      chromaTenant: config.chromaTenant,
      chromaDatabase: config.chromaDatabase,
    });

    await api.initialize();

    spinner.succeed('PromptEnhance initialized!');
    return api;
  } catch (error: any) {
    spinner.fail(`Failed to initialize: ${error.message}`);
    throw error;
  }
}

// Config command: Manage user configuration
program
  .command('config')
  .description('Manage PromptEnhance configuration')
  .argument('[action]', 'Action: set, get, list, or path')
  .argument('[key]', 'Config key (openaiApiKey, chromaServerUrl, etc.)')
  .argument('[value]', 'Config value')
  .action(async (action, key, value) => {
    try {
      if (!action || action === 'list') {
        // Show current configuration
        const config = await ConfigManager.display();
        console.log(chalk.blue.bold('\nCurrent Configuration:\n'));
        console.log(
          chalk.gray(`Config file: ${ConfigManager.getConfigPath()}\n`)
        );

        if (Object.values(config).every((v) => !v)) {
          console.log(
            chalk.yellow(
              'No configuration set. Use "promptenhance config set" to configure.\n'
            )
          );
        } else {
          if (config.openaiApiKey) {
            console.log(
              chalk.gray(`OpenAI API Key:    ${config.openaiApiKey}`)
            );
          }
          if (config.chromaServerUrl) {
            console.log(
              chalk.gray(`Chroma Server URL: ${config.chromaServerUrl}`)
            );
          }
          if (config.chromaAuthToken) {
            console.log(
              chalk.gray(`Chroma Auth Token: ${config.chromaAuthToken}`)
            );
          }
          if (config.chromaTenant) {
            console.log(
              chalk.gray(`Chroma Tenant:     ${config.chromaTenant}`)
            );
          }
          if (config.chromaDatabase) {
            console.log(
              chalk.gray(`Chroma Database:   ${config.chromaDatabase}`)
            );
          }
          console.log();
        }
      } else if (action === 'set') {
        if (!key) {
          // Interactive setup
          console.log(chalk.blue.bold('\nPromptEnhance Setup\n'));
          console.log(chalk.gray('Configure your API keys and services.\n'));

          const answers = await inquirer.prompt([
            {
              type: 'input',
              name: 'openaiApiKey',
              message:
                'OpenAI API Key (optional, leave empty for mock embeddings):',
              default: await ConfigManager.get('openaiApiKey'),
            },
            {
              type: 'input',
              name: 'chromaServerUrl',
              message: 'ChromaDB Server URL (optional, leave empty for local):',
              default: await ConfigManager.get('chromaServerUrl'),
            },
            {
              type: 'input',
              name: 'chromaAuthToken',
              message: 'ChromaDB Auth Token (optional):',
              default: await ConfigManager.get('chromaAuthToken'),
              when: (ans) => !!ans.chromaServerUrl,
            },
            {
              type: 'input',
              name: 'chromaTenant',
              message: 'ChromaDB Tenant (optional):',
              default: await ConfigManager.get('chromaTenant'),
              when: (ans) => !!ans.chromaServerUrl,
            },
            {
              type: 'input',
              name: 'chromaDatabase',
              message: 'ChromaDB Database (optional):',
              default: await ConfigManager.get('chromaDatabase'),
              when: (ans) => !!ans.chromaServerUrl,
            },
          ]);

          await ConfigManager.save(answers);
          console.log(chalk.green('\nConfiguration saved!\n'));
        } else {
          // Set specific key
          if (!value) {
            console.error(
              chalk.red(
                '\nError: Value is required when setting a specific key\n'
              )
            );
            console.log(
              chalk.gray('Usage: promptenhance config set <key> <value>\n')
            );
            process.exit(1);
          }

          const validKeys = [
            'openaiApiKey',
            'chromaServerUrl',
            'chromaAuthToken',
            'chromaTenant',
            'chromaDatabase',
          ];
          if (!validKeys.includes(key)) {
            console.error(chalk.red(`\nError: Invalid key "${key}"\n`));
            console.log(chalk.gray(`Valid keys: ${validKeys.join(', ')}\n`));
            process.exit(1);
          }

          await ConfigManager.save({ [key]: value });
          console.log(chalk.green(`\nSet ${key}\n`));
        }
      } else if (action === 'get') {
        if (!key) {
          console.error(chalk.red('\nError: Key is required\n'));
          console.log(chalk.gray('Usage: promptenhance config get <key>\n'));
          process.exit(1);
        }

        const val = await ConfigManager.get(key as any);
        if (val) {
          console.log(val);
        } else {
          console.error(chalk.yellow(`\nWarning: ${key} is not set\n`));
        }
      } else if (action === 'path') {
        console.log(ConfigManager.getConfigPath());
      } else if (action === 'unset') {
        if (!key) {
          console.error(chalk.red('\nError: Key is required\n'));
          console.log(chalk.gray('Usage: promptenhance config unset <key>\n'));
          process.exit(1);
        }

        await ConfigManager.unset(key as any);
        console.log(chalk.green(`\nUnset ${key}\n`));
      } else {
        console.error(chalk.red(`\nError: Unknown action "${action}"\n`));
        console.log(chalk.gray('Valid actions: set, get, list, unset, path\n'));
        process.exit(1);
      }
    } catch (error: any) {
      console.error(chalk.red(`\nError: ${error.message}\n`));
      process.exit(1);
    }
  });

program
  .command('init')
  .description('Initialize PromptEnhance for current project')
  .option('-p, --path <path>', 'Project path', process.cwd())
  .option('--openai-key <key>', 'OpenAI API key')
  .option('--chroma-url <url>', 'ChromaDB server URL')
  .option('--chroma-token <token>', 'ChromaDB auth token')
  .option('--chroma-tenant <tenant>', 'ChromaDB tenant')
  .option('--chroma-db <database>', 'ChromaDB database')
  .action(async (options) => {
    console.log(chalk.blue.bold('\nPromptEnhance Setup\n'));

    try {
      await initializeAPI(options.path, {
        openaiKey: options.openaiKey,
        chromaUrl: options.chromaUrl,
        chromaToken: options.chromaToken,
        chromaTenant: options.chromaTenant,
        chromaDb: options.chromaDb,
      });

      const stats = await api!.getStats();
      const info = api!.getProjectInfo();

      console.log(chalk.green('\n Project initialized successfully!\n'));
      console.log(chalk.gray(`Project: ${info?.name}`));
      console.log(chalk.gray(`Language: ${info?.primaryLanguage}`));
      console.log(chalk.gray(`Files indexed: ${info?.files.length}`));
      console.log(chalk.gray(`Documents created: ${stats.count}\n`));
    } catch (error: any) {
      console.error(chalk.red(`\nError: ${error.message}\n`));
      process.exit(1);
    }
  });

// Enhance command: Enhance a prompt

program
  .command('enhance <prompt>')
  .description('Enhance a prompt with codebase context')
  .option('-p, --path <path>', 'Project path', process.cwd())
  .option('-t, --tokens <number>', 'Max context tokens', '4000')
  .option('--no-git', 'Exclude git context')
  .option('-o, --output <file>', 'Save enhanced prompt to file')
  .option('--openai-key <key>', 'OpenAI API key')
  .option('--chroma-url <url>', 'ChromaDB server URL')
  .option('--chroma-token <token>', 'ChromaDB auth token')
  .option('--chroma-tenant <tenant>', 'ChromaDB tenant')
  .option('--chroma-db <database>', 'ChromaDB database')
  .action(async (prompt, options) => {
    try {
      if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
        console.error(chalk.red('\nError: Prompt cannot be empty\n'));
        process.exit(1);
      }

      if (prompt.length > 50000) {
        console.error(
          chalk.red('\nError: Prompt too long (max 50000 characters)\n')
        );
        process.exit(1);
      }

      const maxTokens = parseInt(options.tokens);
      if (isNaN(maxTokens) || maxTokens < 100 || maxTokens > 100000) {
        console.error(
          chalk.red(
            '\nError: Invalid token count (must be between 100 and 100000)\n'
          )
        );
        process.exit(1);
      }

      await initializeAPI(options.path, {
        openaiKey: options.openaiKey,
        chromaUrl: options.chromaUrl,
        chromaToken: options.chromaToken,
        chromaTenant: options.chromaTenant,
        chromaDb: options.chromaDb,
      });

      const spinner = ora('Enhancing prompt...').start();

      const enhanced = await api!.enhance(prompt, {
        maxContextTokens: maxTokens,
        includeGitContext: options.git,
      });

      spinner.succeed('Prompt enhanced!');

      console.log(chalk.blue.bold('\n Enhanced Prompt\n'));
      console.log(chalk.gray('─'.repeat(60)));
      console.log(enhanced.enhanced);
      console.log(chalk.gray('─'.repeat(60)));

      console.log(chalk.gray('\nStats'));
      console.log(
        chalk.gray(`Files included: ${enhanced.context.files.length}`)
      );
      console.log(chalk.gray(`  Tokens used: ${enhanced.metadata.tokenCount}`));
      console.log(chalk.gray(`  Intent: ${enhanced.metadata.analysis.intent}`));
      console.log(
        chalk.gray(
          `Confidence: ${(enhanced.metadata.analysis.confidence * 100).toFixed(0)}%\n`
        )
      );

      if (options.output) {
        await fs.writeFile(options.output, enhanced.enhanced);
        console.log(chalk.green(`Saved to ${options.output}\n`));
      }
    } catch (error: any) {
      console.error(chalk.red(`\nError: ${error.message}\n`));
      process.exit(1);
    }
  });

//  Interactive command: Interactive mode

program
  .command('interactive')
  .alias('i')
  .description('Start interactive prompt enhancement mode')
  .option('-p, --path <path>', 'Project path', process.cwd())
  .option('--openai-key <key>', 'OpenAI API key')
  .option('--chroma-url <url>', 'ChromaDB server URL')
  .option('--chroma-token <token>', 'ChromaDB auth token')
  .option('--chroma-tenant <tenant>', 'ChromaDB tenant')
  .option('--chroma-db <database>', 'ChromaDB database')
  .action(async (options) => {
    try {
      await initializeAPI(options.path, {
        openaiKey: options.openaiKey,
        chromaUrl: options.chromaUrl,
        chromaToken: options.chromaToken,
        chromaTenant: options.chromaTenant,
        chromaDb: options.chromaDb,
      });

      console.log(chalk.blue.bold('\n PromptEnhance Interactive Mode\n'));
      console.log(
        chalk.gray('Type your prompts and get enhanced versions instantly.')
      );
      console.log(chalk.gray('Type "exit" or press Ctrl+C to quit.\n'));

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { prompt } = await inquirer.prompt([
          {
            type: 'input',
            name: 'prompt',
            message: 'Prompt:',
          },
        ]);

        if (prompt.toLowerCase() === 'exit') {
          console.log(chalk.blue('\nGoodbye!\n'));
          break;
        }

        if (!prompt.trim()) continue;

        const spinner = ora('Enhancing...').start();

        try {
          const enhanced = await api!.enhance(prompt);
          spinner.succeed('Enhanced!');

          console.log(chalk.gray('\n' + '─'.repeat(60)));
          console.log(enhanced.enhanced);
          console.log(chalk.gray('─'.repeat(60) + '\n'));

          const { action } = await inquirer.prompt([
            {
              type: 'list',
              name: 'action',
              message: 'What next?',
              choices: [
                { name: 'Enter another prompt', value: 'continue' },
                { name: 'Copy to clipboard', value: 'copy' },
                { name: 'Save to file', value: 'save' },
                { name: 'Exit', value: 'exit' },
              ],
            },
          ]);

          if (action === 'exit') {
            console.log(chalk.blue('\nGoodbye!\n'));
            break;
          } else if (action === 'save') {
            const { filename } = await inquirer.prompt([
              {
                type: 'input',
                name: 'filename',
                message: 'Filename:',
                default: 'enhanced-prompt.txt',
              },
            ]);
            await fs.writeFile(filename, enhanced.enhanced);
            console.log(chalk.green(`\n Saved to ${filename}\n`));
          }
        } catch (error: any) {
          spinner.fail(`Error: ${error.message}`);
        }
      }
    } catch (error: any) {
      console.error(chalk.red(`\n Error: ${error.message}\n`));
      process.exit(1);
    }
  });

program
  .command('info')
  .description('Show information about the indexed project')
  .option('-p, --path <path>', 'Project path', process.cwd())
  .option('--openai-key <key>', 'OpenAI API key')
  .option('--chroma-url <url>', 'ChromaDB server URL')
  .option('--chroma-token <token>', 'ChromaDB auth token')
  .option('--chroma-tenant <tenant>', 'ChromaDB tenant')
  .option('--chroma-db <database>', 'ChromaDB database')
  .action(async (options) => {
    try {
      await initializeAPI(options.path, {
        openaiKey: options.openaiKey,
        chromaUrl: options.chromaUrl,
        chromaToken: options.chromaToken,
        chromaTenant: options.chromaTenant,
        chromaDb: options.chromaDb,
      });

      const info = api!.getProjectInfo();
      const stats = await api!.getStats();

      if (!info) {
        console.log(chalk.red('\nNo project information available\n'));
        return;
      }

      console.log(chalk.blue.bold('\n Project Information\n'));
      console.log(chalk.gray(`Name:             ${info.name}`));
      console.log(chalk.gray(`Path:             ${info.rootPath}`));
      console.log(chalk.gray(`Primary Language: ${info.primaryLanguage}`));
      console.log(chalk.gray(`Files:            ${info.files.length}`));
      console.log(chalk.gray(`Documents:        ${stats.count}`));

      if (Object.keys(info.dependencies).length > 0) {
        console.log(
          chalk.gray(`\nDependencies: ${Object.keys(info.dependencies).length}`)
        );
        const topDeps = Object.keys(info.dependencies).slice(0, 10);
        topDeps.forEach((dep) => {
          console.log(chalk.gray(`  • ${dep}`));
        });
        if (Object.keys(info.dependencies).length > 10) {
          console.log(
            chalk.gray(
              `  ... and ${Object.keys(info.dependencies).length - 10} more`
            )
          );
        }
      }

      if (info.git) {
        console.log(chalk.gray(`\nGit:`));
        console.log(chalk.gray(`  Branch: ${info.git.branch}`));
        console.log(
          chalk.gray(`Status: ${info.git.isDirty ? 'Dirty' : 'Clean'}`)
        );
        console.log(
          chalk.gray(`Recent commits: ${info.git.recentCommits.length}`)
        );
      }

      console.log('');
    } catch (error: any) {
      console.error(chalk.red(`\n Error: ${error.message}\n`));
      process.exit(1);
    }
  });

// Reindex command: Re-index the project

program
  .command('reindex')
  .description('Re-index the project (useful after file changes)')
  .option('-p, --path <path>', 'Project path', process.cwd())
  .option('--openai-key <key>', 'OpenAI API key')
  .option('--chroma-url <url>', 'ChromaDB server URL')
  .option('--chroma-token <token>', 'ChromaDB auth token')
  .option('--chroma-tenant <tenant>', 'ChromaDB tenant')
  .option('--chroma-db <database>', 'ChromaDB database')
  .action(async (options) => {
    try {
      await initializeAPI(options.path, {
        openaiKey: options.openaiKey,
        chromaUrl: options.chromaUrl,
        chromaToken: options.chromaToken,
        chromaTenant: options.chromaTenant,
        chromaDb: options.chromaDb,
      });

      const spinner = ora('Re-indexing project...').start();

      await api!.reindex();

      spinner.succeed('Project re-indexed!');

      const stats = await api!.getStats();
      console.log(chalk.gray(`\nDocuments: ${stats.count}\n`));
    } catch (error: any) {
      console.error(chalk.red(`\n Error: ${error.message}\n`));
      process.exit(1);
    }
  });

program
  .name('promptenhance')
  .description(
    'AI Prompt Context Optimizer - Enhance prompts with codebase context'
  )
  .version('0.1.0');

program.parse();
