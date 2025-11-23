// ContextRetriever - Retrieves relevant code context based on prompt analysis

import type {
  PromptAnalysis,
  RetrievedContext,
  FileContext,
  CodeChunk,
  ProjectInfo,
} from '../types/index.js';
import type { VectorDB } from '../db/VectorDB.js';

export interface RetrievalOptions {
  /** Maximum number of results to retrieve */
  topK?: number;
  maxTokens?: number;
  includeGitContext?: boolean;
  includeDependencies?: boolean;
  minRelevance?: number;
}

const DEFAULT_OPTIONS: Required<RetrievalOptions> = {
  topK: 20,
  maxTokens: 4000,
  includeGitContext: true,
  includeDependencies: true,
  minRelevance: 0.5,
};

export class ContextRetriever {
  private vectorDB: VectorDB;
  private project: ProjectInfo;
  private options: Required<RetrievalOptions>;

  constructor(
    vectorDB: VectorDB,
    project: ProjectInfo,
    options: RetrievalOptions = {}
  ) {
    this.vectorDB = vectorDB;
    this.project = project;
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  async retrieve(analysis: PromptAnalysis): Promise<RetrievedContext> {
    // Step 1: Semantic search for relevant code
    const searchResults = await this.vectorDB.search(
      analysis.original,
      this.options.topK
    );

    // Step 2: Filter by relevance threshold
    const relevantResults = searchResults.filter(
      (r) => r.score >= this.options.minRelevance
    );

    // Step 3: Group by file and create FileContext
    const fileContextMap = new Map<string, FileContext>();

    for (const result of relevantResults) {
      const filePath = result.document.metadata.filePath;

      if (!fileContextMap.has(filePath)) {
        fileContextMap.set(filePath, {
          path: filePath,
          chunks: [],
          relevance: result.score,
          reason: this.explainRelevance(result, analysis),
        });
      }

      const fileContext = fileContextMap.get(filePath)!;

      fileContext.chunks.push({
        content: result.document.content,
        startLine: result.document.metadata.startLine,
        endLine: result.document.metadata.endLine,
        type: result.document.metadata.type as any,
        relevance: result.score,
      });

      // Update file relevance (max of chunk scores)
      fileContext.relevance = Math.max(fileContext.relevance, result.score);
    }

    // Step 4: Sort files by relevance
    const files = Array.from(fileContextMap.values()).sort(
      (a, b) => b.relevance - a.relevance
    );

    // Step 5: Fit within token budget
    const { files: fittedFiles, tokenCount } = this.fitWithinTokenBudget(
      files,
      this.options.maxTokens
    );

    // Step 6: Get dependencies if requested
    const dependencies = this.options.includeDependencies
      ? this.getRelevantDependencies(fittedFiles)
      : [];

    // Step 7: Get git context if requested
    const gitContext = this.options.includeGitContext
      ? this.getGitContext(fittedFiles)
      : undefined;

    // Step 8: Detect code conventions
    const conventions = this.detectConventions();

    return {
      files: fittedFiles,
      conventions,
      dependencies,
      gitContext,
      tokenCount,
    };
  }


  private explainRelevance(
    result: any,
    analysis: PromptAnalysis
  ): string {
    const reasons: string[] = [];

    // Check if entities match
    const content = result.document.content.toLowerCase();
    const matchedEntities = analysis.entities.filter((e) =>
      content.includes(e.toLowerCase())
    );

    if (matchedEntities.length > 0) {
      reasons.push(`Contains: ${matchedEntities.join(', ')}`);
    }

    if (result.document.metadata.name) {
      reasons.push(`Found ${result.document.metadata.type}: ${result.document.metadata.name}`);
    }

    if (result.score > 0.8) {
      reasons.push('High semantic similarity');
    } else if (result.score > 0.6) {
      reasons.push('Moderate semantic similarity');
    }

    return reasons.join('; ') || 'Semantically related';
  }


  private fitWithinTokenBudget(
    files: FileContext[],
    maxTokens: number
  ): { files: FileContext[]; tokenCount: number } {
    const fittedFiles: FileContext[] = [];
    let currentTokens = 0;

    for (const file of files) {
      // Estimate tokens (rough: 4 chars = 1 token)
      const fileTokens = this.estimateTokens(file);

      if (currentTokens + fileTokens <= maxTokens) {
        fittedFiles.push(file);
        currentTokens += fileTokens;
      } else {
        // Try to fit some chunks from this file
        const fittedChunks: CodeChunk[] = [];
        for (const chunk of file.chunks) {
          const chunkTokens = this.estimateTokens(chunk.content);
          if (currentTokens + chunkTokens <= maxTokens) {
            fittedChunks.push(chunk);
            currentTokens += chunkTokens;
          } else {
            break;
          }
        }

        if (fittedChunks.length > 0) {
          fittedFiles.push({
            ...file,
            chunks: fittedChunks,
          });
        }

        break;
      }
    }

    return { files: fittedFiles, tokenCount: currentTokens };
  }


  private estimateTokens(content: string | FileContext): number {
    if (typeof content === 'string') {
      // Rough estimate: 4 characters = 1 token
      return Math.ceil(content.length / 4);
    } else {
      // FileContext
      return content.chunks.reduce(
        (sum, chunk) => sum + this.estimateTokens(chunk.content),
        0
      );
    }
  }


  private getRelevantDependencies(files: FileContext[]): string[] {
    const allDeps = Object.keys(this.project.dependencies);
    const relevantDeps = new Set<string>();

    // Find dependencies mentioned in the relevant files
    for (const file of files) {
      for (const chunk of file.chunks) {
        const content = chunk.content.toLowerCase();
        for (const dep of allDeps) {
          if (content.includes(dep.toLowerCase())) {
            relevantDeps.add(dep);
          }
        }
      }
    }

    return Array.from(relevantDeps);
  }


  private getGitContext(files: FileContext[]) {
    if (!this.project.git) {
      return undefined;
    }

    const filePaths = files.map((f) => f.path);

    // Find commits that touched these files
    const relatedCommits = this.project.git.recentCommits.filter((commit) =>
      commit.filesChanged.some((f) => filePaths.includes(f))
    );

    return {
      branch: this.project.git.branch,
      recentChanges: files.map((f) => f.path),
      relatedCommits: relatedCommits.slice(0, 5), // Top 5 relevant commits
    };
  }

  private detectConventions() {
    // Simple heuristics for now
    // In a real implementation, this would analyze the codebase

    const conventions: any = {
      namingStyle: 'camelCase',
      asyncPattern: 'async/await',
      errorHandling: 'try/catch',
      importStyle: 'named',
    };

    // Detect from project language
    if (this.project.primaryLanguage === 'python') {
      conventions.namingStyle = 'snake_case';
    }

    if ('jest' in this.project.dependencies) {
      conventions.testFramework = 'jest';
    } else if ('pytest' in this.project.dependencies) {
      conventions.testFramework = 'pytest';
    } else if ('mocha' in this.project.dependencies) {
      conventions.testFramework = 'mocha';
    }

    return conventions;
  }
}
