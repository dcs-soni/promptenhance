import { ChromaClient, CloudClient, Collection } from 'chromadb';
import type { EmbeddingDocument, SearchResult } from '../types/index.js';
import { logger } from '../utils/logger.js';
import type { EmbeddingProvider } from './Embeddings.js';

export interface VectorDBOptions {
  serverUrl?: string;
  collectionName: string;
  embeddingProvider: EmbeddingProvider;
  path?: string;
  authToken?: string;
  tenant?: string;
  database?: string;
}

export class VectorDB {
  private client: ChromaClient | CloudClient;
  private collection: Collection | null = null;
  private options: VectorDBOptions;
  private static readonly MAX_CACHE_SIZE = 1000;
  private embeddingCache = new Map<string, number[]>();

  constructor(options: VectorDBOptions) {
    this.options = options;

    const isCloudClient = options.tenant && options.database && options.authToken;

    if (isCloudClient) {
      // Use CloudClient for ChromaDB Cloud
      logger.info('Using ChromaDB Cloud with tenant:', options.tenant);
      this.client = new CloudClient({
        tenant: options.tenant!,
        database: options.database!,
        apiKey: options.authToken!,
      });
    } else {
      const clientConfig: any = {
        path: options.serverUrl || 'http://localhost:8000',
      };

      if (options.authToken) {
        clientConfig.auth = {
          provider: 'token',
          credentials: options.authToken,
        };
      }

      logger.info('Using local ChromaClient at:', clientConfig.path);
      this.client = new ChromaClient(clientConfig);
    }
  }

  
  // Initialize the collection
   
  async initialize(): Promise<void> {
    try {
      this.collection = await this.client.getOrCreateCollection({
        name: this.options.collectionName,
        metadata: {
          'hnsw:space': 'cosine',
        },
      });

      logger.info(
        `Initialized collection: ${this.options.collectionName}`
      );
    } catch (error) {
      logger.error('Error initializing vector database:', error);
      throw error;
    }
  }

  async addDocuments(documents: EmbeddingDocument[]): Promise<void> {
    if (!this.collection) {
      throw new Error('Collection not initialized');
    }

    if (documents.length === 0) {
      return;
    }

    try {
      const texts = documents.map((doc) => doc.content);
      const embeddings = await this.generateEmbeddings(texts);

      // Prepare data for ChromaDB
      const ids = documents.map((doc) => doc.id);
      const metadatas = documents.map((doc) => ({
        ...doc.metadata,
        // Convert non-serializable types to strings
        filePath: doc.metadata.filePath,
        startLine: doc.metadata.startLine,
        endLine: doc.metadata.endLine,
        type: doc.metadata.type,
        language: doc.metadata.language,
      }));

      await this.collection.add({
        ids,
        embeddings,
        metadatas: metadatas as any[],
        documents: texts,
      });

      documents.forEach((doc, i) => {
        this.embeddingCache.set(doc.id, embeddings[i]);
      });

      logger.info(`Added ${documents.length} documents to collection`);
    } catch (error) {
      logger.error('Error adding documents:', error);
      throw error;
    }
  }

  async search(
    query: string,
    topK: number = 10,
    filter?: Record<string, any>
  ): Promise<SearchResult[]> {
    if (!this.collection) {
      throw new Error('Collection not initialized');
    }

    try {
      const queryEmbedding = await this.generateEmbeddings([query]);

      // Search
      const results = await this.collection.query({
        queryEmbeddings: queryEmbedding,
        nResults: topK,
        where: filter,
      });

      const searchResults: SearchResult[] = [];

      if (
        results.ids &&
        results.ids[0] &&
        results.distances &&
        results.distances[0] &&
        results.documents &&
        results.documents[0] &&
        results.metadatas &&
        results.metadatas[0]
      ) {
        for (let i = 0; i < results.ids[0].length; i++) {
          const id = results.ids[0][i];
          const distance = results.distances![0][i];
          const content = results.documents[0][i];
          const metadata = results.metadatas[0][i];

          if (!content || !metadata || distance === null) continue;

          searchResults.push({
            document: {
              id,
              content,
              metadata: metadata as any,
            },
            score: 1 - distance, // Convert distance to similarity score
            distance,
          });
        }
      }

      return searchResults;
    } catch (error) {
      logger.error('Error searching:', error);
      throw error;
    }
  }

  async deleteDocuments(filter: Record<string, any>): Promise<void> {
    if (!this.collection) {
      throw new Error('Collection not initialized');
    }

    try {
      await this.collection.delete({
        where: filter,
      });
      logger.info('Deleted documents matching filter');
    } catch (error) {
      logger.error('Error deleting documents:', error);
      throw error;
    }
  }

 
  async clear(): Promise<void> {
    if (!this.collection) {
      throw new Error('Collection not initialized');
    }

    try {
      await this.client.deleteCollection({
        name: this.options.collectionName,
      });

      this.collection = await this.client.createCollection({
        name: this.options.collectionName,
        metadata: {
          'hnsw:space': 'cosine',
        },
      });

      this.embeddingCache.clear();
      logger.info('Cleared collection');
    } catch (error) {
      logger.error('Error clearing collection:', error);
      throw error;
    }
  }


  async getStats(): Promise<{ count: number }> {
    if (!this.collection) {
      throw new Error('Collection not initialized');
    }

    try {
      const count = await this.collection.count();
      return { count };
    } catch (error) {
      logger.error('Error getting stats:', error);
      throw error;
    }
  }

  private async generateEmbeddings(texts: string[]): Promise<number[][]> {
    const uncachedTexts: string[] = [];
    const uncachedIndices: number[] = [];
    const results: number[][] = new Array(texts.length);

    texts.forEach((text, i) => {
      const cached = this.embeddingCache.get(text);
      if (cached) {
        results[i] = cached;
      } else {
        uncachedTexts.push(text);
        uncachedIndices.push(i);
      }
    });

    if (uncachedTexts.length > 0) {
      const embeddings = await this.options.embeddingProvider.generateEmbeddings(
        uncachedTexts
      );

      embeddings.forEach((embedding, i) => {
        const originalIndex = uncachedIndices[i];
        results[originalIndex] = embedding;

        // Evict oldest entries if cache is full (Map preserves insertion order)
        if (this.embeddingCache.size >= VectorDB.MAX_CACHE_SIZE) {
          const firstKey = this.embeddingCache.keys().next().value;
          if (firstKey !== undefined) {
            this.embeddingCache.delete(firstKey);
          }
        }

        this.embeddingCache.set(uncachedTexts[i], embedding);
      });
    }

    return results;
  }

 
  async close(): Promise<void> {
    // ChromaDB doesn't need explicit closing but clear cache - verify
    this.embeddingCache.clear();
    logger.info('Closed vector database');
  }
}
