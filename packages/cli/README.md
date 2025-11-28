# PromptEnhance CLI

> AI Prompt Context Optimizer - Enhance your prompts with relevant codebase context

PromptEnhance CLI enhances developer prompts with relevant codebase context. It indexes your codebase, creates semantic embeddings, and intelligently retrieves relevant code snippets to enrich your prompts before sending them to LLMs.

## Features

- **Semantic Code Search** - Uses embeddings to find relevant code based on intent
- **Intelligent Context Addition** - Automatically includes relevant files and snippets
- **Multiple Modes** - One-shot enhancement, interactive mode.
- **Configurable** - Support for OpenAI embeddings or local mock embeddings
- **ChromaDB Integration** - Use local or cloud-hosted vector database

## Installation

### Global Installation (Recommended)

```bash
npm install -g @promptenhance/cli
# or
pnpm add -g @promptenhance/cli
# or
yarn global add @promptenhance/cli
```

### npx (No Installation Required)

```bash
npx @promptenhance/cli enhance "fix the authentication bug"
```

## Quick Start

### 1. Configure Your API Keys (Optional but Recommended)

PromptEnhance can work with mock embeddings, but for best results, configure your OpenAI API key:

```bash
# Interactive setup (recommended)
promptenhance config set

# Or set individual values
promptenhance config set openaiApiKey sk-your-key-here
```

Configuration is stored in `~/.promptenhance/config.json`

### 2. Index Your Project

Navigate to your project directory and initialize:

```bash
cd /path/to/your/project
promptenhance init
```

This will scan your codebase, create embeddings, and store them in a vector database.

### 3. Enhance Your Prompts

```bash
promptenhance enhance "add user authentication"
```

The CLI will:

1. Analyze your prompt intent
2. Search for relevant code in your project
3. Add context to your prompt
4. Display the enhanced prompt

## Usage

### Commands

#### `config` - Manage Configuration

Configure your API keys and services:

```bash
# Interactive setup
promptenhance config set

# View current configuration
promptenhance config list

# Set specific key
promptenhance config set openaiApiKey sk-your-key

# Get specific key
promptenhance config get openaiApiKey

# Remove a key
promptenhance config unset openaiApiKey

# Show config file path
promptenhance config path
```

#### `init` - Initialize Project

Index your codebase:

```bash
promptenhance init [options]

Options:
  -p, --path <path>              Project path (default: current directory)
  --openai-key <key>             OpenAI API key (overrides config)
  --chroma-url <url>             ChromaDB server URL (overrides config)
  --chroma-token <token>         ChromaDB auth token
  --chroma-tenant <tenant>       ChromaDB tenant
  --chroma-db <database>         ChromaDB database
```

#### `enhance` - Enhance a Prompt

Enhance a single prompt with codebase context:

```bash
promptenhance enhance "<your-prompt>" [options]

Options:
  -p, --path <path>              Project path (default: current directory)
  -t, --tokens <number>          Max context tokens (default: 4000)
  --no-git                       Exclude git context
  -o, --output <file>            Save enhanced prompt to file
  --openai-key <key>             OpenAI API key (overrides config)
  --chroma-url <url>             ChromaDB server URL (overrides config)

Examples:
  promptenhance enhance "fix the authentication bug"
  promptenhance enhance "add error handling" -t 8000
  promptenhance enhance "refactor user service" -o prompt.txt
```

#### `interactive` - Interactive Mode

Start an interactive session for multiple prompts:

```bash
promptenhance interactive [options]
# or
promptenhance i [options]

Options:
  -p, --path <path>              Project path (default: current directory)
  --openai-key <key>             OpenAI API key (overrides config)
```

Type your prompts, get enhanced versions, and choose to copy, save, or continue.

#### `info` - Show Project Info

Display information about the indexed project:

```bash
promptenhance info [options]

Options:
  -p, --path <path>              Project path (default: current directory)
```

#### `reindex` - Re-index Project

Re-index your project after making changes:

```bash
promptenhance reindex [options]

Options:
  -p, --path <path>              Project path (default: current directory)
```

## Configuration

PromptEnhance supports three ways to configure API keys and services, with the following priority:

1. **CLI Flags** (highest priority)
2. **Environment Variables**
3. **Config File** (`~/.promptenhance/config.json`)

### Configuration Options

| Config Key        | Environment Variable                   | CLI Flag          | Description                                           |
| ----------------- | -------------------------------------- | ----------------- | ----------------------------------------------------- |
| `openaiApiKey`    | `OPENAI_API_KEY`                       | `--openai-key`    | OpenAI API key for embeddings (optional)              |
| `chromaServerUrl` | `CHROMA_SERVER_URL`                    | `--chroma-url`    | ChromaDB server URL (optional, uses local if not set) |
| `chromaAuthToken` | `CHROMA_API_KEY` / `CHROMA_AUTH_TOKEN` | `--chroma-token`  | ChromaDB API key (prefers CHROMA_API_KEY)             |
| `chromaTenant`    | `CHROMA_TENANT`                        | `--chroma-tenant` | ChromaDB tenant name (for Cloud)                      |
| `chromaDatabase`  | `CHROMA_DATABASE`                      | `--chroma-db`     | ChromaDB database name (for Cloud)                    |

### Configuration Methods

#### Method 1: Config File (Recommended)

```bash
# Interactive setup
promptenhance config set

# Manual file creation
echo '{
  "openaiApiKey": "sk-your-key-here",
  "chromaServerUrl": "https://your-chroma-instance.com"
}' > ~/.promptenhance/config.json
```

#### Method 2: Environment Variables

```bash
export OPENAI_API_KEY=sk-your-key-here
export CHROMA_SERVER_URL=https://your-chroma-instance.com

promptenhance init
```

#### Method 3: CLI Flags

```bash
promptenhance init --openai-key sk-your-key-here --chroma-url https://your-chroma-instance.com
```

### Using Without OpenAI API Key

PromptEnhance can work with mock embeddings if you don't have an OpenAI API key:

```bash
# Just run without configuring API keys
promptenhance init
promptenhance enhance "your prompt"
```

Mock embeddings use basic text similarity instead of semantic embeddings. For production use, OpenAI embeddings are recommended.

## ChromaDB Options

### Option 1: Local ChromaDB (Default)

If you don't configure ChromaDB settings, PromptEnhance uses a local ChromaDB instance. No additional setup required.

### Option 2: ChromaDB Cloud (Recommended)

Configure ChromaDB Cloud for persistent, shared embeddings:

```bash
promptenhance config set
# Enter your ChromaDB Cloud credentials when prompted
```

Or set via environment variables:

```bash
# For ChromaDB Cloud (CHROMA_SERVER_URL not needed, defaults to api.trychroma.com)
export CHROMA_API_KEY=ck-your-api-key-here
export CHROMA_TENANT=your-tenant-id
export CHROMA_DATABASE=your-database-name
```

## Examples

### Example 1: Fix a Bug

```bash
promptenhance enhance "fix the authentication bug in login"
```

Output includes:

- Relevant authentication code
- Login-related files
- Recent git changes
- Error handling patterns

### Example 2: Add a New Feature

```bash
promptenhance enhance "add password reset functionality" -t 8000
```

### Example 3: Refactor Code

```bash
promptenhance enhance "refactor the user service to use async/await"
```

### Example 4: Interactive Mode

```bash
promptenhance interactive

Prompt: fix the database connection error
[Enhanced prompt displayed]

What next?
> Enter another prompt
  Copy to clipboard
  Save to file
  Exit
```

### Example 5: CI/CD Integration

```bash
# Use in scripts with CLI flags
promptenhance enhance "analyze test failures" \
  --openai-key $OPENAI_API_KEY \
  --output enhanced-prompt.txt
```

## Troubleshooting

### "No configuration set"

Run `promptenhance config set` to configure your API keys, or use CLI flags.

### "Failed to initialize"

- Check your OpenAI API key is valid
- Ensure you're in a valid project directory
- Check network connectivity for ChromaDB Cloud

### "No relevant code found"

- Make sure you ran `promptenhance init` first
- Try re-indexing: `promptenhance reindex`
- Use more specific prompts

### Mock Embeddings Warning

If you see "Using mock embeddings", you haven't configured an OpenAI API key. Mock embeddings work but are less accurate than semantic embeddings.

## Security Best Practices

1. **Never commit API keys** - Use config file or environment variables
2. **Use environment variables in CI/CD** - Don't hardcode keys in scripts
3. **Rotate keys regularly** - Update your OpenAI API key periodically
4. **Secure config file** - The `~/.promptenhance/config.json` file contains sensitive data

## License

MIT
