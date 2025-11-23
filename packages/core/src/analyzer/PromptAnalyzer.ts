
// PromptAnalyzer - Analyzes developer prompts to understand intent and extract entities

import type { PromptAnalysis, PromptIntent, PromptScope } from '../types/index.js';

const INTENT_KEYWORDS: Record<PromptIntent, string[]> = {
  bugfix: [
    'fix',
    'bug',
    'error',
    'broken',
    'not working',
    'crash',
    'issue',
    'problem',
    'debug',
  ],
  feature: [
    'add',
    'create',
    'implement',
    'build',
    'make',
    'new',
    'feature',
    'functionality',
  ],
  refactor: [
    'refactor',
    'restructure',
    'reorganize',
    'improve',
    'optimize',
    'clean up',
    'simplify',
  ],
  question: [
    'how',
    'what',
    'why',
    'where',
    'when',
    'explain',
    'show',
    'tell',
    '?',
  ],
  documentation: [
    'document',
    'comment',
    'docs',
    'docstring',
    'readme',
    'explain',
    'describe',
  ],
  test: [
    'test',
    'unit test',
    'integration test',
    'e2e',
    'spec',
    'coverage',
  ],
  unknown: [],
};

const SCOPE_KEYWORDS: Record<PromptScope, string[]> = {
  function: ['function', 'method', 'fn', 'handler', 'callback'],
  class: ['class', 'component', 'model', 'controller', 'service'],
  file: ['file', 'module', 'script'],
  module: ['module', 'package', 'library', 'folder', 'directory'],
  project: ['project', 'app', 'application', 'codebase', 'repo', 'all'],
};

export class PromptAnalyzer {
  analyze(prompt: string): PromptAnalysis {
    const lowerPrompt = prompt.toLowerCase();

    const intent = this.detectIntent(lowerPrompt);

    const entities = this.extractEntities(prompt);

    const scope = this.detectScope(lowerPrompt, entities);

    const estimatedFiles = this.estimateFilesAffected(intent, scope, entities);

    const confidence = this.calculateConfidence(intent, entities);

    return {
      original: prompt,
      intent,
      entities,
      scope,
      estimatedFiles,
      confidence,
    };
  }

  
  private detectIntent(lowerPrompt: string): PromptIntent {
    const scores: Record<PromptIntent, number> = {
      bugfix: 0,
      feature: 0,
      refactor: 0,
      question: 0,
      documentation: 0,
      test: 0,
      unknown: 0,
    };

    // Score each intent based on keyword matches
    for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
      for (const keyword of keywords) {
        if (lowerPrompt.includes(keyword)) {
          scores[intent as PromptIntent] += 1;
        }
      }
    }

    // Return intent with highest score
    const entries = Object.entries(scores).sort(([, a], [, b]) => b - a);
    const [topIntent, topScore] = entries[0];

    if (topScore === 0) {
      return 'unknown';
    }

    return topIntent as PromptIntent;
  }

  
  // Extract file names, function names, libraries
  
  private extractEntities(prompt: string): string[] {
    const entities: Set<string> = new Set();

    const camelCaseRegex = /\b[a-z][a-zA-Z0-9]*[A-Z][a-zA-Z0-9]*\b/g;
    const pascalCaseRegex = /\b[A-Z][a-zA-Z0-9]*\b/g;

    const camelMatches = prompt.match(camelCaseRegex) || [];
    const pascalMatches = prompt.match(pascalCaseRegex) || [];

    camelMatches.forEach((m) => entities.add(m));
    pascalMatches.forEach((m) => {
      // Filter out common English words in PascalCase
      if (m.length > 2 && !/^(The|This|That|For|And|But|Or)$/.test(m)) {
        entities.add(m);
      }
    });

    const snakeCaseRegex = /\b[a-z][a-z0-9_]*_[a-z0-9_]*\b/g;
    const snakeMatches = prompt.match(snakeCaseRegex) || [];
    snakeMatches.forEach((m) => entities.add(m));

    const filePathRegex = /\b[\w-]+\.[\w-]+(?:\/[\w-]+\.[\w-]+)*\b/g;
    const fileMatches = prompt.match(filePathRegex) || [];
    fileMatches.forEach((m) => entities.add(m));

    const quotedRegex = /["'`]([^"'`]+)["'`]/g;
    let match;
    while ((match = quotedRegex.exec(prompt)) !== null) {
      entities.add(match[1]);
    }

    const libraryRegex = /\b(?:react|vue|angular|express|django|flask|next|node|typescript|python|java|go|rust)\b/gi;
    const libMatches = prompt.match(libraryRegex) || [];
    libMatches.forEach((m) => entities.add(m.toLowerCase()));

    return Array.from(entities);
  }

  
  // Detect the scope of the change
  private detectScope(lowerPrompt: string, entities: string[]): PromptScope {
    const scores: Record<PromptScope, number> = {
      function: 0,
      class: 0,
      file: 0,
      module: 0,
      project: 0,
    };

    // Score based on scope keywords
    for (const [scope, keywords] of Object.entries(SCOPE_KEYWORDS)) {
      for (const keyword of keywords) {
        if (lowerPrompt.includes(keyword)) {
          scores[scope as PromptScope] += 1;
        }
      }
    }

    // Score based on entities
    if (entities.some((e) => e.includes('.'))) {
      // Has file extensions
      scores.file += 2;
    }

    if (entities.some((e) => /^[A-Z]/.test(e))) {
      // Has PascalCase (likely class/component names)
      scores.class += 1;
    }

    if (entities.some((e) => e.includes('/'))) {
      // Has path separators
      scores.module += 1;
    }

    // Return scope with highest score
    const entries = Object.entries(scores).sort(([, a], [, b]) => b - a);
    const [topScope] = entries[0];

    return topScope as PromptScope;
  }

  private estimateFilesAffected(
    intent: PromptIntent,
    scope: PromptScope,
    entities: string[]
  ): number {
    // Base estimates by scope
    const scopeEstimates: Record<PromptScope, number> = {
      function: 1,
      class: 1,
      file: 1,
      module: 3,
      project: 10,
    };

    let estimate = scopeEstimates[scope];

    if (intent === 'feature') {
      estimate *= 2; // Features often touch multiple files
    } else if (intent === 'refactor') {
      estimate *= 1.5;
    } else if (intent === 'question') {
      estimate *= 0.5; 
    }

    // Adjust based on entities
    const fileEntities = entities.filter((e) => e.includes('.'));
    if (fileEntities.length > 0) {
      estimate = Math.max(estimate, fileEntities.length);
    }

    return Math.ceil(estimate);
  }

  
  // Calculate confidence in the analysis
   
  private calculateConfidence(intent: PromptIntent, entities: string[]): number {
    let confidence = 0.5; 

    if (intent !== 'unknown') {
      confidence += 0.2;
    }

    if (entities.length > 0) {
      confidence += Math.min(0.3, entities.length * 0.1);
    }

    return Math.min(1.0, confidence);
  }
}
