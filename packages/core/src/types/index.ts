

export interface FileInfo {
  path: string;
  relativePath: string;
  language: string;
  size: number;
  lastModified: Date;
  imports: string[];
  exports: string[];
  hash?: string;
}

export interface ProjectInfo {
  rootPath: string;
  name: string;
  primaryLanguage: string;
  files: FileInfo[];
  dependencies: Record<string, string>;
  git?: GitInfo;
}

export interface GitInfo {
  branch: string;
  recentCommits: GitCommit[];
  isDirty: boolean;
}

export interface GitCommit {
  hash: string;
  message: string;
  author: string;
  date: Date;
  filesChanged: string[];
}


export interface FunctionInfo {
  name: string;
  startLine: number;
  endLine: number;
  params: string[];
  returnType?: string;
  docstring?: string;
  isAsync?: boolean;
  isExported?: boolean;
}

export interface ClassInfo {
  name: string;
  startLine: number;
  endLine: number;
  methods: FunctionInfo[];
  properties: PropertyInfo[];
  extends?: string;
  implements?: string[];
  isExported?: boolean;
}

export interface PropertyInfo {
  name: string;
  type?: string;
  isStatic?: boolean;
  isPrivate?: boolean;
}

export interface ImportInfo {
  module: string;
  symbols: string[];
  type: 'named' | 'default' | 'namespace';
  isExternal: boolean;
}


export interface CodeConventions {
  namingStyle: 'camelCase' | 'snake_case' | 'PascalCase' | 'kebab-case';
  asyncPattern: 'async/await' | 'promises' | 'callbacks';
  errorHandling: 'try/catch' | 'Result<T,E>' | 'throws' | 'Error-first-callback';
  testFramework?: string;
  importStyle: 'named' | 'default' | 'mixed';
  maxLineLength?: number;
  useSemicolons?: boolean;
  quoteStyle?: 'single' | 'double';
}


export interface PromptAnalysis {
  original: string;
  intent: PromptIntent;
  entities: string[];
  scope: PromptScope;
  estimatedFiles: number;
  confidence: number;
}

export type PromptIntent =
  | 'bugfix'
  | 'feature'
  | 'refactor'
  | 'question'
  | 'documentation'
  | 'test'
  | 'unknown';

export type PromptScope =
  | 'function'
  | 'class'
  | 'file'
  | 'module'
  | 'project';


export interface RetrievedContext {
  files: FileContext[];
  conventions: CodeConventions;
  dependencies: string[];
  gitContext?: GitContext;
  tokenCount: number;
}

export interface FileContext {
  path: string;
  chunks: CodeChunk[];
  relevance: number;
  reason: string;
}

export interface CodeChunk {
  content: string;
  startLine: number;
  endLine: number;
  type: 'function' | 'class' | 'block' | 'file';
  relevance: number;
}

export interface GitContext {
  branch: string;
  recentChanges: string[];
  relatedCommits: GitCommit[];
}


export interface EnhancedPrompt {
  original: string;
  enhanced: string;
  context: RetrievedContext;
  metadata: {
    analysis: PromptAnalysis;
    template: string;
    timestamp: Date;
    tokenCount: number;
  };
}

export interface EnhanceOptions {
  maxContextTokens?: number;
  includeGitContext?: boolean;
  includeDependencies?: boolean;
  includeConventions?: boolean;
  template?: string;
  targetModel?: 'claude' | 'gpt' | 'gemini' | 'generic';
}


export interface EmbeddingDocument {
  id: string;
  content: string;
  embedding?: number[];
  metadata: {
    filePath: string;
    startLine: number;
    endLine: number;
    type: string;
    language: string;
    [key: string]: any;
  };
}

export interface SearchResult {
  document: EmbeddingDocument;
  score: number;
  distance: number;
}

export interface PromptEnhanceConfig {
  projectPath: string;

  index: {
    include: string[];
    exclude: string[];
    languages: string[];
    followSymlinks?: boolean;
  };

  embeddings: {
    provider: 'openai' | 'local';
    model?: string;
    chunkSize?: number;
    apiKey?: string;
  };

  enhancement: {
    maxContextTokens: number;
    includeGitContext: boolean;
    includeDependencies: boolean;
    includeConventions: boolean;
  };

  templates?: {
    bugfix?: string;
    feature?: string;
    refactor?: string;
    question?: string;
  };

  conventions?: Partial<CodeConventions>;
}

export type IndexingEvent =
  | { type: 'start'; totalFiles: number }
  | { type: 'progress'; current: number; total: number; file: string }
  | { type: 'complete'; filesIndexed: number; duration: number }
  | { type: 'error'; error: Error };

export type IndexingEventCallback = (event: IndexingEvent) => void;
