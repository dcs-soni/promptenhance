import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { PromptEnhanceAPI } from '@promptenhance/core';

// Get project path from environment or args
const PROJECT_PATH = process.env.PROJECT_PATH || process.cwd();
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const CHROMA_SERVER_URL = process.env.CHROMA_SERVER_URL;
const CHROMA_AUTH_TOKEN =
  process.env.CHROMA_API_KEY || process.env.CHROMA_AUTH_TOKEN;
const CHROMA_TENANT = process.env.CHROMA_TENANT;
const CHROMA_DATABASE = process.env.CHROMA_DATABASE;

//  MCP Server for PromptEnhance

class PromptEnhanceMCPServer {
  private server: Server;
  private api: PromptEnhanceAPI | null = null;
  private isInitialized = false;

  constructor() {
    this.server = new Server(
      {
        name: 'promptenhance',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'enhance_prompt',
            description:
              'Enhance a developer prompt with relevant codebase context. Takes a natural language prompt and returns an enriched version with code snippets, file structure, conventions, and dependencies.',
            inputSchema: {
              type: 'object',
              properties: {
                prompt: {
                  type: 'string',
                  description: 'The developer prompt to enhance',
                },
                maxTokens: {
                  type: 'number',
                  description:
                    'Maximum number of tokens for context (default: 4000)',
                  default: 4000,
                },
                includeGitContext: {
                  type: 'boolean',
                  description: 'Include git branch and commit history',
                  default: true,
                },
              },
              required: ['prompt'],
            },
          },
          {
            name: 'index_project',
            description:
              'Index or re-index the current project. Scans all code files, extracts structure, and creates embeddings for semantic search.',
            inputSchema: {
              type: 'object',
              properties: {
                force: {
                  type: 'boolean',
                  description: 'Force re-indexing even if already indexed',
                  default: false,
                },
              },
            },
          },
          {
            name: 'get_project_info',
            description:
              'Get information about the indexed project including file count, languages, dependencies, and conventions.',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'search_codebase',
            description:
              'Search the codebase semantically for relevant code based on a query.',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Search query',
                },
                topK: {
                  type: 'number',
                  description: 'Number of results to return',
                  default: 10,
                },
              },
              required: ['query'],
            },
          },
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'enhance_prompt':
            return await this.handleEnhancePrompt(args);

          case 'index_project':
            return await this.handleIndexProject(args);

          case 'get_project_info':
            return await this.handleGetProjectInfo();

          case 'search_codebase':
            return await this.handleSearchCodebase(args);

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`,
            },
          ],
        };
      }
    });
  }

  /**
   * Ensure API is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      console.error('Initializing PromptEnhance.');

      // Sanitize collection name to prevent injection attacks
      const sanitizedPath = PROJECT_PATH.replace(/[^a-zA-Z0-9-_]/g, '');
      const collectionHash = Buffer.from(PROJECT_PATH)
        .toString('base64')
        .slice(0, 16)
        .replace(/[^a-zA-Z0-9]/g, '');
      const collectionName = `promptenhance-${collectionHash}`;

      this.api = new PromptEnhanceAPI({
        projectPath: PROJECT_PATH,
        embeddingProvider: OPENAI_API_KEY ? 'openai' : 'mock',
        openaiApiKey: OPENAI_API_KEY,
        collectionName,
        chromaServerUrl: CHROMA_SERVER_URL,
        chromaAuthToken: CHROMA_AUTH_TOKEN,
        chromaTenant: CHROMA_TENANT,
        chromaDatabase: CHROMA_DATABASE,
      });

      await this.api.initialize();
      this.isInitialized = true;

      console.error('✓ PromptEnhance initialized');
    }
  }

  private async handleEnhancePrompt(args: any) {
    await this.ensureInitialized();

    if (!this.api) {
      throw new Error('API not initialized');
    }

    const { prompt, maxTokens = 4000, includeGitContext = true } = args;

    // Input validation
    if (!prompt || typeof prompt !== 'string') {
      throw new Error('Invalid prompt: must be a non-empty string');
    }

    if (prompt.length > 50000) {
      throw new Error('Prompt too long: maximum 50000 characters');
    }

    if (
      typeof maxTokens !== 'number' ||
      maxTokens < 100 ||
      maxTokens > 100000
    ) {
      throw new Error('Invalid maxTokens: must be between 100 and 100000');
    }

    const enhanced = await this.api.enhance(prompt, {
      maxContextTokens: maxTokens,
      includeGitContext,
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              enhanced: enhanced.enhanced,
              stats: {
                filesIncluded: enhanced.context.files.length,
                tokensUsed: enhanced.metadata.tokenCount,
                intent: enhanced.metadata.analysis.intent,
                confidence: enhanced.metadata.analysis.confidence,
              },
            },
            null,
            2
          ),
        },
      ],
    };
  }

  private async handleIndexProject(args: any) {
    const { force } = args;

    if (force && this.api) {
      await this.api.reindex();
    } else {
      await this.ensureInitialized();
    }

    const stats = await this.api!.getStats();

    return {
      content: [
        {
          type: 'text',
          text: `✓ Project indexed. Documents in database: ${stats.count}`,
        },
      ],
    };
  }

  private async handleGetProjectInfo() {
    await this.ensureInitialized();

    const info = this.api!.getProjectInfo();

    if (!info) {
      throw new Error('Project info not available');
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              name: info.name,
              rootPath: info.rootPath,
              primaryLanguage: info.primaryLanguage,
              filesCount: info.files.length,
              dependencies: Object.keys(info.dependencies),
              git: info.git
                ? {
                    branch: info.git.branch,
                    isDirty: info.git.isDirty,
                    recentCommits: info.git.recentCommits
                      .slice(0, 5)
                      .map((c) => c.message),
                  }
                : null,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  private async handleSearchCodebase(args: any) {
    await this.ensureInitialized();

    // Input validation
    if (!args.query || typeof args.query !== 'string') {
      throw new Error('Invalid query: must be a non-empty string');
    }

    if (args.query.length > 10000) {
      throw new Error('Query too long: maximum 10000 characters');
    }

    const topK = args.topK || 10;
    if (typeof topK !== 'number' || topK < 1 || topK > 100) {
      throw new Error('Invalid topK: must be between 1 and 100');
    }

    // This is a simplified version - in a full implementation considerexposing the vector DB search directly
    const enhanced = await this.api!.enhance(args.query, {
      maxContextTokens: 2000,
    });

    const results = enhanced.context.files.map((file) => ({
      path: file.path,
      relevance: file.relevance,
      reason: file.reason,
      preview: file.chunks[0]?.content.slice(0, 200) + '...',
    }));

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(results, null, 2),
        },
      ],
    };
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    console.error('PromptEnhance MCP Server running on stdio');
    console.error(`Project: ${PROJECT_PATH}`);
    console.error(
      `Embedding provider: ${OPENAI_API_KEY ? 'OpenAI' : 'Mock (local)'}`
    );
  }
}

const server = new PromptEnhanceMCPServer();
server.start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
