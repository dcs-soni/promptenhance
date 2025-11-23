
// Embeddings - Generate embeddings for code chunks
// Supports OpenAI and local embedding models
 
import OpenAI from 'openai';

export interface EmbeddingProvider {
  generateEmbeddings(texts: string[]): Promise<number[][]>;
  getDimensions(): number;
}

export interface OpenAIEmbeddingOptions {
  apiKey: string;
  model?: string;
  batchSize?: number;
}

export class OpenAIEmbeddings implements EmbeddingProvider {
  private client: OpenAI;
  private model: string;
  private batchSize: number;

  constructor(options: OpenAIEmbeddingOptions) {
    this.client = new OpenAI({ apiKey: options.apiKey });
    this.model = options.model || 'text-embedding-3-small';
    this.batchSize = options.batchSize || 100;
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    const embeddings: number[][] = [];

    // Process in batches to avoid rate limits
    for (let i = 0; i < texts.length; i += this.batchSize) {
      const batch = texts.slice(i, i + this.batchSize);

      try {
        const response = await this.client.embeddings.create({
          model: this.model,
          input: batch,
        });

        const batchEmbeddings = response.data.map((item) => item.embedding);
        embeddings.push(...batchEmbeddings);

        // Small delay to avoid rate limits
        if (i + this.batchSize < texts.length) {
          await this.delay(100);
        }
      } catch (error) {
        console.error('Error generating embeddings:', error);
        throw error;
      }
    }

    return embeddings;
  }

  getDimensions(): number {
    // text-embedding-3-small: 1536 dimensions
    // text-embedding-3-large: 3072 dimensions
    return this.model.includes('large') ? 3072 : 1536;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}


// Mock/Local Embedding Provider

export class MockEmbeddings implements EmbeddingProvider {
  private dimensions: number;

  constructor(dimensions: number = 384) {
    this.dimensions = dimensions;
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    // Generate simple hash-based embeddings for testing
    return texts.map((text) => this.hashToEmbedding(text));
  }

  getDimensions(): number {
    return this.dimensions;
  }

  private hashToEmbedding(text: string): number[] {
    // Simple deterministic embedding based on text content
    // Not useful for real semantic search, but works for testing
    const embedding = new Array(this.dimensions).fill(0);

    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i);
      const index = (i * 17 + charCode) % this.dimensions;
      embedding[index] += charCode / 255;
    }

    // Normalize
    const magnitude = Math.sqrt(
      embedding.reduce((sum, val) => sum + val * val, 0)
    );
    return embedding.map((val) => val / (magnitude || 1));
  }
}


//  Factory function to create embedding provider
 
export function createEmbeddingProvider(
  provider: 'openai' | 'mock',
  options?: OpenAIEmbeddingOptions
): EmbeddingProvider {
  switch (provider) {
    case 'openai':
      if (!options?.apiKey) {
        throw new Error('OpenAI API key required');
      }
      return new OpenAIEmbeddings(options);
    case 'mock':
      return new MockEmbeddings();
    default:
      throw new Error(`Unknown embedding provider: ${provider}`);
  }
}
