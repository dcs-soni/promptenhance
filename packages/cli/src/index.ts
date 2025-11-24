import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../../../.env') });

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { PromptEnhanceAPI } from '@promptenhance/core';
import * as fs from 'fs/promises';
import * as path from 'path';

const program = new Command();

// Global API instance
let api: PromptEnhanceAPI | null = null;

async function initializeAPI(projectPath: string): Promise<PromptEnhanceAPI> {
  if (api) return api;

  const spinner = ora('Initializing PromptEnhance...').start();

  try {
    const openaiApiKey = process.env.OPENAI_API_KEY;
    const chromaServerUrl = process.env.CHROMA_SERVER_URL;
    const chromaAuthToken = process.env.CHROMA_AUTH_TOKEN;
    const chromaTenant = process.env.CHROMA_TENANT;
    const chromaDatabase = process.env.CHROMA_DATABASE;

    api = new PromptEnhanceAPI({
      projectPath,
      embeddingProvider: openaiApiKey ? 'openai' : 'mock',
      openaiApiKey,
      collectionName: `promptenhance-${path.basename(projectPath)}`,
      chromaServerUrl,
      chromaAuthToken,
      chromaTenant,
      chromaDatabase,
    });

    await api.initialize();

    spinner.succeed('PromptEnhance initialized!');
    return api;
  } catch (error: any) {
    spinner.fail(`Failed to initialize: ${error.message}`);
    throw error;
  }
}

program
  .command('init')
  .description('Initialize PromptEnhance for current project')
  .option('-p, --path <path>', 'Project path', process.cwd())
  .action(async (options) => {
    console.log(chalk.blue.bold('\nPromptEnhance Setup\n'));

    try {
      await initializeAPI(options.path);

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
  .action(async (prompt, options) => {
    try {
      await initializeAPI(options.path);

      const spinner = ora('Enhancing prompt...').start();

      const enhanced = await api!.enhance(prompt, {
        maxContextTokens: parseInt(options.tokens),
        includeGitContext: options.git,
      });

      spinner.succeed('Prompt enhanced!');

      console.log(chalk.blue.bold('\n Enhanced Prompt\n'));
      console.log(chalk.gray('─'.repeat(60)));
      console.log(enhanced.enhanced);
      console.log(chalk.gray('─'.repeat(60)));

      console.log(chalk.gray('\nStats'));
      console.log(chalk.gray(`  Files included: ${enhanced.context.files.length}`));
      console.log(chalk.gray(`  Tokens used: ${enhanced.metadata.tokenCount}`));
      console.log(chalk.gray(`  Intent: ${enhanced.metadata.analysis.intent}`));
      console.log(
        chalk.gray(`  Confidence: ${(enhanced.metadata.analysis.confidence * 100).toFixed(0)}%\n`)
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
  .action(async (options) => {
    try {
      await initializeAPI(options.path);

      console.log(chalk.blue.bold('\n PromptEnhance Interactive Mode\n'));
      console.log(chalk.gray('Type your prompts and get enhanced versions instantly.'));
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
  .action(async (options) => {
    try {
      await initializeAPI(options.path);

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
            chalk.gray(`  ... and ${Object.keys(info.dependencies).length - 10} more`)
          );
        }
      }

      if (info.git) {
        console.log(chalk.gray(`\nGit:`));
        console.log(chalk.gray(`  Branch: ${info.git.branch}`));
        console.log(chalk.gray(`  Status: ${info.git.isDirty ? 'Dirty' : 'Clean'}`));
        console.log(chalk.gray(`  Recent commits: ${info.git.recentCommits.length}`));
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
  .action(async (options) => {
    try {
      await initializeAPI(options.path);

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
  .description('AI Prompt Context Optimizer - Enhance prompts with codebase context')
  .version('0.1.0');

program.parse();
