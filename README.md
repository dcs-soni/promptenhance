# promptenhance

AI prompt context optimizer that enhances developer prompts with relevant codebase context using semantic search and vector embeddings.

## Architecture

**Core Pipeline:**

1. **CodebaseIndexer** - Scans files (respects .gitignore), chunks code semantically
2. **VectorDB** - Stores embeddings in ChromaDB (local or cloud)
3. **PromptEnhancer** - Analyzes intent, retrieves context, formats enhanced prompts

**Monorepo Structure:**

- `@promptenhance/core` - Core indexing and enhancement library
- `@promptenhance/cli` - Standalone command-line interface
- `@promptenhance/mcp-server` - Model Context Protocol server for Claude Code

## Installation

### Requirements

- Node.js >= 18
- pnpm (recommended) or npm >= 9

### Setup

```bash
# Install dependencies
pnpm install

# Build all packages (order matters: core -> mcp-server -> cli)
pnpm build

```

## Configuration

### Environment Variables

```bash
# Required for production embeddings
OPENAI_API_KEY=sk-...

# ChromaDB Cloud (optional - uses local ChromaDB if not set)
# For CloudClient, CHROMA_SERVER_URL is not needed (defaults to api.trychroma.com)
CHROMA_API_KEY=ck-...
CHROMA_TENANT=...
CHROMA_DATABASE=...

# For local ChromaDB server
CHROMA_SERVER_URL=http://localhost:8000

# Optional
PROJECT_PATH=/path/to/project  # defaults to cwd
```

### Embedding Providers

#### OpenAI (Production)

- Uses `text-embedding-3-small` (1536 dimensions)
- High-quality semantic understanding
- Cost: $0.02 per 1M tokens

## Mock (Development)

- Deterministic hash-based embeddings
- Zero API cost, no network calls
- Not suitable for production (no semantic similarity)

System automatically selects mock provider when `OPENAI_API_KEY` is not set.

## Usage

### CLI

```bash
# Index project
promptenhance index /path/to/project

# Enhance prompt
promptenhance enhance "Add user validation to signup endpoint"

# Search codebase
promptenhance search "authentication middleware"
```

### MCP Server

The MCP server exposes four tools for Claude Code:

- `enhance_prompt` - Enhance prompt with codebase context
- `index_project` - Index or re-index project
- `get_project_info` - Get indexed project metadata
- `search_codebase` - Semantic code search

## API Reference

### PromptEnhanceAPI

**Constructor Options:**

```typescript
interface InitOptions {
  projectPath: string;
  embeddingProvider?: 'openai' | 'mock';
  openaiApiKey?: string;
  collectionName?: string;
  chromaServerUrl?: string;
  chromaAuthToken?: string;
  chromaTenant?: string;
  chromaDatabase?: string;
}
```

**Methods:**

- `initialize(): Promise<void>` - Index codebase and initialize vector DB
- `enhancePrompt(prompt: string, options?: EnhanceOptions): Promise<EnhancedPrompt>`
- `getProjectInfo(): ProjectInfo`
- `searchCodebase(query: string, limit?: number): Promise<SearchResult[]>`

### EnhanceOptions

```typescript
interface EnhanceOptions {
  maxContextTokens?: number; // default: 4000
  includeGitContext?: boolean; // default: true
  includeDependencies?: boolean; // default: true
  includeConventions?: boolean; // default: true
  template?: string; // custom template
  targetModel?: 'claude' | 'gpt' | 'gemini' | 'generic';
}
```

### PromptIntent Types

Automatically detected intents:

- `bugfix` - Fix bugs or errors
- `feature` - Add new functionality
- `refactor` - Restructure existing code
- `question` - Answer questions about code
- `documentation` - Generate or update docs
- `test` - Write or fix tests
- `unknown` - Unclassified

## Technical Details

### Chunking Strategy

- **Function-level** - Individual functions with context
- **Class-level** - Complete class definitions
- **Block-level** - Logical code blocks (loops, conditionals)
- Uses tree-sitter for JS/TS/Python AST parsing

### Vector Storage

- **ChromaDB** - Open-source vector database
- **Local mode** - Embedded database for development
- **Cloud mode** - ChromaDB Cloud for production
- Cosine similarity for semantic search

### Token Counting

Approximates tokens using character-based heuristic:

- Code: ~4 characters per token
- Natural language: ~3.5 characters per token

## Project Structure

```
packages/
├── core/              # @promptenhance/core
│   ├── indexer/       # File scanning, chunking, AST parsing
│   ├── db/            # Vector DB, embeddings
│   ├── enhancer/      # Prompt analysis, context retrieval
│   └── types/         # TypeScript interfaces
├── cli/               # @promptenhance/cli
└── mcp-server/        # @promptenhance/mcp-server
```
