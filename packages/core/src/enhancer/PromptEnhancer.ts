
// PromptEnhancer - Main class that orchestrates prompt enhancement


import { PromptAnalyzer } from '../analyzer/PromptAnalyzer.js';
import { ContextRetriever, type RetrievalOptions } from '../retriever/ContextRetriever.js';
import { getTemplate, type TemplateData } from './Templates.js';
import type {
  EnhancedPrompt,
  EnhanceOptions,
  ProjectInfo,
} from '../types/index.js';
import type { VectorDB } from '../db/VectorDB.js';

export class PromptEnhancer {
  private analyzer: PromptAnalyzer;
  private retriever: ContextRetriever;
  private project: ProjectInfo;

  constructor(vectorDB: VectorDB, project: ProjectInfo, options?: RetrievalOptions) {
    this.analyzer = new PromptAnalyzer();
    this.retriever = new ContextRetriever(vectorDB, project, options);
    this.project = project;
  }


  
  async enhance(
    prompt: string,
    options: EnhanceOptions = {}
  ): Promise<EnhancedPrompt> {
    // Step 1: Analyze the prompt
    const analysis = this.analyzer.analyze(prompt);

    // Step 2: Retrieve relevant context
    const context = await this.retriever.retrieve(analysis);

    // Step 3: Select template
    const template = options.template
      ? this.loadCustomTemplate(options.template)
      : getTemplate(analysis.intent);

    // Step 4: Generate enhanced prompt
    const templateData: TemplateData = {
      original: prompt,
      context,
      projectName: this.project.name,
      primaryLanguage: this.project.primaryLanguage,
    };

    const enhanced = template(templateData);

    // Step 5: Apply target model formatting if specified
    const formatted = this.formatForTarget(enhanced, options.targetModel);

    return {
      original: prompt,
      enhanced: formatted,
      context,
      metadata: {
        analysis,
        template: options.template || analysis.intent,
        timestamp: new Date(),
        tokenCount: context.tokenCount,
      },
    };
  }

  private loadCustomTemplate(template: string): (data: TemplateData) => string {
    // Treat as a template string with variable replacement
    return (data: TemplateData) => {
      let result = template;

      // Simple template variable replacement
      result = result.replace(/\{original\}/g, data.original);
      result = result.replace(/\{projectName\}/g, data.projectName);
      result = result.replace(/\{primaryLanguage\}/g, data.primaryLanguage);

      // Add context
      result += '\n\n## Context\n\n';
      if (data.context.files.length > 0) {
        result += '**Relevant Files:**\n\n';
        for (const file of data.context.files) {
          result += `- ${file.path} (${file.reason})\n`;
        }
      }

      return result;
    };
  }

  private formatForTarget(prompt: string, target?: string): string {
    if (!target || target === 'generic') {
      return prompt;
    }

    switch (target) {
      case 'claude':
        // Claude performs best with XML-tagged context blocks
        return prompt
          .replace(/## Context\n/g, '<context>\n')
          .replace(/## Requirements\n/g, '</context>\n\n<requirements>\n')
          + '\n</requirements>';

      case 'gpt':
        // GPT benefits from system-style instruction prefixes
        return `### System Context\n\nYou are an expert developer working on this codebase. Use the context below to provide accurate, idiomatic solutions.\n\n${prompt}`;

      case 'gemini':
        // Gemini works well with clearly structured markdown sections
        return `## Task\n\nAnalyze the following request using the provided codebase context.\n\n---\n\n${prompt}`;

      default:
        return prompt;
    }
  }

  getStats(enhanced: EnhancedPrompt): {
    originalLength: number;
    enhancedLength: number;
    contextFilesCount: number;
    estimatedTokens: number;
  } {
    return {
      originalLength: enhanced.original.length,
      enhancedLength: enhanced.enhanced.length,
      contextFilesCount: enhanced.context.files.length,
      estimatedTokens: enhanced.metadata.tokenCount,
    };
  }
}
