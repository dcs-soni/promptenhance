
//  PromptEnhance Core - Main entry point. Exports all public APIs


export * from './types/index.js';

export { FileScanner, type ScanOptions } from './indexer/FileScanner.js';
export { ASTParser, type ASTParseResult } from './indexer/ASTParser.js';
export { Chunker, type ChunkOptions } from './indexer/Chunker.js';
export {
  CodebaseIndexer,
  type IndexerOptions,
  type IndexResult,
} from './indexer/CodebaseIndexer.js';

export {
  createEmbeddingProvider,
  OpenAIEmbeddings,
  MockEmbeddings,
  type EmbeddingProvider,
  type OpenAIEmbeddingOptions,
} from './db/Embeddings.js';
export { VectorDB, type VectorDBOptions } from './db/VectorDB.js';

export { PromptAnalyzer } from './analyzer/PromptAnalyzer.js';

export {
  ContextRetriever,
  type RetrievalOptions,
} from './retriever/ContextRetriever.js';

export { PromptEnhancer } from './enhancer/PromptEnhancer.js';
export { getTemplate, type TemplateData } from './enhancer/Templates.js';

export { PromptEnhanceAPI } from './PromptEnhanceAPI.js';
