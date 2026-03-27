
// Templates - Prompt enhancement templates for different intents
 

import type {
  PromptIntent,
  RetrievedContext,
  FileContext,
} from '../types/index.js';

export interface TemplateData {
  original: string;
  context: RetrievedContext;
  projectName: string;
  primaryLanguage: string;
}

export function getTemplate(intent: PromptIntent): (data: TemplateData) => string {
  switch (intent) {
    case 'bugfix':
      return bugfixTemplate;
    case 'feature':
      return featureTemplate;
    case 'refactor':
      return refactorTemplate;
    case 'question':
      return questionTemplate;
    case 'documentation':
      return documentationTemplate;
    case 'test':
      return testTemplate;
    default:
      return genericTemplate;
  }
}

function bugfixTemplate(data: TemplateData): string {
  let enhanced = data.original + '\n\n';

  enhanced += '## Context\n\n';
  enhanced += `**Project:** ${data.projectName} (${data.primaryLanguage})\n\n`;

  if (data.context.files.length > 0) {
    enhanced += '**Relevant Code:**\n\n';
    for (const file of data.context.files.slice(0, 3)) {
      enhanced += formatFileContext(file);
    }
  }

  if (data.context.conventions.errorHandling) {
    enhanced += `**Error Handling Pattern:** ${data.context.conventions.errorHandling}\n\n`;
  }

  // Recent changes
  if (data.context.gitContext) {
    enhanced += '**Recent Changes:**\n';
    enhanced += `Branch: ${data.context.gitContext.branch}\n`;
    if (data.context.gitContext.relatedCommits.length > 0) {
      enhanced += 'Recent commits to related files:\n';
      for (const commit of data.context.gitContext.relatedCommits.slice(0, 3)) {
        enhanced += `- ${commit.message} (${commit.author})\n`;
      }
    }
    enhanced += '\n';
  }

  enhanced += '## Requirements\n\n';
  enhanced += `- Follow the existing ${data.context.conventions.errorHandling} pattern\n`;
  enhanced += `- Maintain ${data.context.conventions.namingStyle} naming convention\n`;
  enhanced += '- Add appropriate error messages\n';
  if (data.context.conventions.testFramework) {
    enhanced += `- Update tests (using ${data.context.conventions.testFramework})\n`;
  }

  return enhanced;
}


function featureTemplate(data: TemplateData): string {
  let enhanced = data.original + '\n\n';

  enhanced += '## Context\n\n';
  enhanced += `**Project:** ${data.projectName} (${data.primaryLanguage})\n\n`;

  enhanced += '**Project Structure:**\n';
  enhanced += formatProjectStructure(data.context.files);
  enhanced += '\n';

  if (data.context.files.length > 0) {
    enhanced += '**Similar Existing Code:**\n\n';
    for (const file of data.context.files.slice(0, 2)) {
      enhanced += formatFileContext(file);
    }
  }

  if (data.context.dependencies.length > 0) {
    enhanced += `**Available Dependencies:** ${data.context.dependencies.join(', ')}\n\n`;
  }

  enhanced += '**Team Conventions:**\n';
  enhanced += `- Naming: ${data.context.conventions.namingStyle}\n`;
  enhanced += `- Async: ${data.context.conventions.asyncPattern}\n`;
  enhanced += `- Imports: ${data.context.conventions.importStyle}\n`;
  enhanced += '\n';

  enhanced += '## Requirements\n\n';
  enhanced += '- Follow existing patterns shown above\n';
  enhanced += '- Use available dependencies where appropriate\n';
  enhanced += `- Add tests using ${data.context.conventions.testFramework || 'appropriate framework'}\n`;
  enhanced += '- Include appropriate error handling\n';
  enhanced += '- Add documentation/comments\n';

  return enhanced;
}


function refactorTemplate(data: TemplateData): string {
  let enhanced = data.original + '\n\n';

  enhanced += '## Context\n\n';
  enhanced += `**Project:** ${data.projectName} (${data.primaryLanguage})\n\n`;

  if (data.context.files.length > 0) {
    enhanced += '**Code to Refactor:**\n\n';
    for (const file of data.context.files.slice(0, 3)) {
      enhanced += formatFileContext(file);
    }
  }

  if (data.context.dependencies.length > 0) {
    enhanced += `**Dependencies:** ${data.context.dependencies.join(', ')}\n\n`;
  }

  enhanced += '**Conventions:**\n';
  enhanced += `- Naming: ${data.context.conventions.namingStyle}\n`;
  enhanced += `- Async: ${data.context.conventions.asyncPattern}\n`;
  enhanced += `- Error handling: ${data.context.conventions.errorHandling}\n`;
  enhanced += '\n';

  enhanced += '## Requirements\n\n';
  enhanced += '- Preserve existing functionality\n';
  enhanced += '- Improve code readability and maintainability\n';
  enhanced += '- Follow established conventions\n';
  enhanced += '- Update tests as needed\n';
  enhanced += '- Keep changes minimal and focused\n';

  return enhanced;
}


function questionTemplate(data: TemplateData): string {
  let enhanced = data.original + '\n\n';

  enhanced += '## Context\n\n';
  enhanced += `**Project:** ${data.projectName} (${data.primaryLanguage})\n\n`;

  if (data.context.files.length > 0) {
    enhanced += '**Relevant Code:**\n\n';
    for (const file of data.context.files.slice(0, 3)) {
      enhanced += formatFileContext(file);
    }
  }

  if (data.context.dependencies.length > 0) {
    enhanced += `**Dependencies:** ${data.context.dependencies.join(', ')}\n\n`;
  }

  return enhanced;
}


function documentationTemplate(data: TemplateData): string {
  let enhanced = data.original + '\n\n';

  enhanced += '## Context\n\n';
  enhanced += `**Project:** ${data.projectName} (${data.primaryLanguage})\n\n`;

  // Code to document
  if (data.context.files.length > 0) {
    enhanced += '**Code to Document:**\n\n';
    for (const file of data.context.files.slice(0, 3)) {
      enhanced += formatFileContext(file);
    }
  }

  enhanced += '## Requirements\n\n';
  enhanced += '- Write clear, concise documentation\n';
  enhanced += '- Include examples where appropriate\n';
  enhanced += '- Document parameters, return values, and exceptions\n';
  enhanced += '- Follow the project\'s documentation style\n';

  return enhanced;
}


function testTemplate(data: TemplateData): string {
  let enhanced = data.original + '\n\n';

  enhanced += '## Context\n\n';
  enhanced += `**Project:** ${data.projectName} (${data.primaryLanguage})\n`;
  enhanced += `**Test Framework:** ${data.context.conventions.testFramework || 'Not specified'}\n\n`;

  if (data.context.files.length > 0) {
    enhanced += '**Code to Test:**\n\n';
    for (const file of data.context.files.slice(0, 3)) {
      enhanced += formatFileContext(file);
    }
  }

  enhanced += '## Requirements\n\n';
  enhanced += `- Use ${data.context.conventions.testFramework || 'appropriate test framework'}\n`;
  enhanced += '- Test happy paths and edge cases\n';
  enhanced += '- Include error scenarios\n';
  enhanced += '- Write clear test descriptions\n';
  enhanced += '- Follow existing test patterns\n';

  return enhanced;
}


function genericTemplate(data: TemplateData): string {
  let enhanced = data.original + '\n\n';

  enhanced += '## Context\n\n';
  enhanced += `**Project:** ${data.projectName} (${data.primaryLanguage})\n\n`;

  if (data.context.files.length > 0) {
    enhanced += '**Relevant Code:**\n\n';
    for (const file of data.context.files.slice(0, 3)) {
      enhanced += formatFileContext(file);
    }
  }

  enhanced += '**Conventions:**\n';
  enhanced += `- Naming: ${data.context.conventions.namingStyle}\n`;
  enhanced += `- Async: ${data.context.conventions.asyncPattern}\n`;
  if (data.context.conventions.testFramework) {
    enhanced += `- Tests: ${data.context.conventions.testFramework}\n`;
  }
  enhanced += '\n';

  return enhanced;
}

function formatFileContext(file: FileContext): string {
  let formatted = `### ${file.path}\n`;
  formatted += `*${file.reason}*\n\n`;

  for (const chunk of file.chunks.slice(0, 2)) {
    // Only show top 2 chunks per file
    formatted += '```\n';
    formatted += `// Lines ${chunk.startLine}-${chunk.endLine}\n`;
    formatted += chunk.content;
    formatted += '\n```\n\n';
  }

  return formatted;
}


function formatProjectStructure(files: FileContext[]): string {
  const filePaths = files.map((f) => f.path).slice(0, 10);

  let formatted = '```\n';
  for (const path of filePaths) {
    formatted += `${path}\n`;
  }
  if (files.length > 10) {
    formatted += `... and ${files.length - 10} more files\n`;
  }
  formatted += '```\n';

  return formatted;
}
