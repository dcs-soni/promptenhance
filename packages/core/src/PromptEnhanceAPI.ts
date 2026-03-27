// PromptEnhanceAPI - High-level API for easy usage


import { CodebaseIndexer, type IndexerOptions } from './indexer/CodebaseIndexer.js';
import { VectorDB } from './db/VectorDB.js';
import { createEmbeddingProvider, type EmbeddingProvider } from './db/Embeddings.js';
import { PromptEnhancer } from './enhancer/PromptEnhancer.js';
import type {
  ProjectInfo,
  EnhancedPrompt,
  EnhanceOptions,
  SearchResult,
} from './types/index.js';
import { logger } from './utils/logger.js';

export interface InitOptions {
  projectPath: string;
  embeddingProvider?: 'openai' | 'mock';
  openaiApiKey?: string;
  collectionName?: string;
  indexerOptions?: IndexerOptions;
  // ChromaDB Cloud options
  chromaServerUrl?: string;
  chromaAuthToken?: string;
  chromaTenant?: string;
  chromaDatabase?: string;
}

export class PromptEnhanceAPI {
  private projectPath: string;
  private vectorDB: VectorDB | null = null;
  private project: ProjectInfo | null = null;
  private enhancer: PromptEnhancer | null = null;
  private embeddingProvider: EmbeddingProvider;
  private collectionName: string;
  private chromaServerUrl?: string;
  private chromaAuthToken?: string;
  private chromaTenant?: string;
  private chromaDatabase?: string;

  constructor(options: InitOptions) {
    this.projectPath = options.projectPath;
    this.collectionName = options.collectionName || 'promptenhance';
    this.chromaServerUrl = options.chromaServerUrl;
    this.chromaAuthToken = options.chromaAuthToken;
    this.chromaTenant = options.chromaTenant;
    this.chromaDatabase = options.chromaDatabase;

    this.embeddingProvider = createEmbeddingProvider(
      options.embeddingProvider || 'mock',
      options.openaiApiKey ? { apiKey: options.openaiApiKey } : undefined
    );
  }


  async initialize(): Promise<void> {
    logger.info('Initializing PromptEnhance');

    // Step 1: Index the codebase
    logger.info('Indexing codebase');
    const indexer = new CodebaseIndexer(this.projectPath);
    const indexResult = await indexer.index();

    this.project = indexResult.project;

    logger.info(`Indexed ${indexResult.stats.filesScanned} files, created ${indexResult.stats.documentsCreated} documents`);

    // Step 2: Initialize vector database
    logger.info('Setting up vector database');
    this.vectorDB = new VectorDB({
      collectionName: this.collectionName,
      embeddingProvider: this.embeddingProvider,
      serverUrl: this.chromaServerUrl,
      authToken: this.chromaAuthToken,
      tenant: this.chromaTenant,
      database: this.chromaDatabase,
    });

    await this.vectorDB.initialize();

    // Step 3: Add documents to vector database
    logger.info('Generating embeddings and storing documents!');
    await this.vectorDB.addDocuments(indexResult.documents);

    // Step 4: Create enhancer
    this.enhancer = new PromptEnhancer(this.vectorDB, this.project);

    logger.info('PromptEnhance initialized successfully!');
  }

  async enhance(
    prompt: string,
    options?: EnhanceOptions
  ): Promise<EnhancedPrompt> {
    if (!this.enhancer) {
      throw new Error('PromptEnhance not initialized. Call initialize() first.');
    }

    return this.enhancer.enhance(prompt, options);
  }


  async reindex(): Promise<void> {
    if (!this.vectorDB) {
      throw new Error('Vector database not initialized');
    }

    logger.info('Re-indexing codebase');

    await this.vectorDB.clear();

    const indexer = new CodebaseIndexer(this.projectPath);
    const indexResult = await indexer.index();

    this.project = indexResult.project;

    await this.vectorDB.addDocuments(indexResult.documents);

    if (this.project) {
      this.enhancer = new PromptEnhancer(this.vectorDB, this.project);
    }

    logger.info('Re-indexing complete!');
  }

  getProjectInfo(): ProjectInfo | null {
    return this.project;
  }

  async searchCodebase(query: string, limit: number = 10): Promise<SearchResult[]> {
    if (!this.vectorDB) {
      throw new Error('Vector database not initialized. Call initialize() first.');
    }

    return this.vectorDB.search(query, limit);
  }

  async getStats(): Promise<{ count: number }> {
    if (!this.vectorDB) {
      throw new Error('Vector database not initialized');
    }

    return this.vectorDB.getStats();
  }

  async close(): Promise<void> {
    if (this.vectorDB) {
      await this.vectorDB.close();
    }
  }
}

export async function createPromptEnhanceAPI(
  options: InitOptions
): Promise<PromptEnhanceAPI> {
  const api = new PromptEnhanceAPI(options);
  await api.initialize();
  return api;
}
