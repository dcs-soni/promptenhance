 // Chunker splits code files into semantic chunks for embedding. Each chunk represents a logical unit (function, class, or section)


import * as fs from 'fs/promises';
import type { EmbeddingDocument } from '../types/index.js';
import { ASTParser, type ASTParseResult } from './ASTParser.js';

export interface ChunkOptions {
  maxChunkSize?: number;
  overlap?: number;
  contextLines?: number;
}

const DEFAULT_OPTIONS: Required<ChunkOptions> = {
  maxChunkSize: 512,
  overlap: 50,
  contextLines: 2,
};

export class Chunker {
  private options: Required<ChunkOptions>;

  constructor(options: ChunkOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

 
  async chunkFile(
    filePath: string,
    language: string
  ): Promise<EmbeddingDocument[]> {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');

    // Try AST-based chunking first
    if (['typescript', 'javascript', 'python'].includes(language)) {
      try {
        const parser = new ASTParser(language);
        const parsed = await parser.parseFile(filePath);
        return this.chunkByAST(filePath, content, lines, parsed, language);
      } catch (error) {
        console.warn(`AST parsing failed for ${filePath}, falling back to line-based chunking`);
      }
    }

    // Fallback to simple line-based chunking
    return this.chunkByLines(filePath, lines, language);
  }

  
  // Chunk by AST nodes (functions, classes)
   
  private chunkByAST(
    filePath: string,
    _content: string,
    lines: string[],
    parsed: ASTParseResult,
    language: string
  ): EmbeddingDocument[] {
    const documents: EmbeddingDocument[] = [];
    let chunkId = 0;

    // Chunk each function
    for (const func of parsed.functions) {
      const startLine = Math.max(0, func.startLine - 1 - this.options.contextLines);
      const endLine = Math.min(lines.length, func.endLine + this.options.contextLines);

      const chunk = lines.slice(startLine, endLine).join('\n');

      // Skip if chunk is too large (likely minified or generated code)
      if (chunk.length > this.options.maxChunkSize * 3) {
        continue;
      }

      documents.push({
        id: `${filePath}:func:${chunkId++}`,
        content: chunk,
        metadata: {
          filePath,
          startLine: func.startLine,
          endLine: func.endLine,
          type: 'function',
          name: func.name,
          language,
          isExported: func.isExported,
          isAsync: func.isAsync,
          docstring: func.docstring,
        },
      });
    }

    // Chunk each class
    for (const cls of parsed.classes) {
      const startLine = Math.max(0, cls.startLine - 1 - this.options.contextLines);
      const endLine = Math.min(lines.length, cls.endLine + this.options.contextLines);

      const chunk = lines.slice(startLine, endLine).join('\n');

      if (chunk.length > this.options.maxChunkSize * 3) {
        // Class is too large, chunk its methods instead
        for (const method of cls.methods) {
          const methodStartLine = Math.max(0, method.startLine - 1);
          const methodEndLine = Math.min(lines.length, method.endLine);
          const methodChunk = lines.slice(methodStartLine, methodEndLine).join('\n');

          documents.push({
            id: `${filePath}:method:${chunkId++}`,
            content: methodChunk,
            metadata: {
              filePath,
              startLine: method.startLine,
              endLine: method.endLine,
              type: 'method',
              name: `${cls.name}.${method.name}`,
              className: cls.name,
              language,
              isExported: method.isExported,
              isAsync: method.isAsync,
            },
          });
        }
      } else {
        documents.push({
          id: `${filePath}:class:${chunkId++}`,
          content: chunk,
          metadata: {
            filePath,
            startLine: cls.startLine,
            endLine: cls.endLine,
            type: 'class',
            name: cls.name,
            language,
            isExported: cls.isExported,
            methodCount: cls.methods.length,
          },
        });
      }
    }

    // If no functions or classes found, do line-based chunking
    if (documents.length === 0) {
      return this.chunkByLines(filePath, lines, language);
    }

    return documents;
  }

  
  
  // Simple line-based chunking (fallback)
  private chunkByLines( 
    filePath: string,
    lines: string[],
    language: string
  ): EmbeddingDocument[] {
    const documents: EmbeddingDocument[] = [];
    const linesPerChunk = Math.ceil(
      this.options.maxChunkSize / 80
    ); 

    for (let i = 0; i < lines.length; i += linesPerChunk) {
      const startLine = i;
      const endLine = Math.min(i + linesPerChunk, lines.length);
      const chunk = lines.slice(startLine, endLine).join('\n');

      if (chunk.trim().length === 0) {
        continue;
      }

      documents.push({
        id: `${filePath}:block:${startLine}`,
        content: chunk,
        metadata: {
          filePath,
          startLine: startLine + 1,
          endLine: endLine,
          type: 'block',
          language,
        },
      });
    }

    return documents;
  }

  /**
   * Create a summary document for the entire file
   */
  async createFileSummary(
    filePath: string,
    language: string
  ): Promise<EmbeddingDocument | null> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');

      // Create a summary with file-level information
      let summary = `File: ${filePath}\n`;
      summary += `Language: ${language}\n`;
      summary += `Lines: ${lines.length}\n\n`;

      // Try to extract top-level structure
      if (['typescript', 'javascript', 'python'].includes(language)) {
        try {
          const parser = new ASTParser(language);
          const parsed = await parser.parseFile(filePath);

          if (parsed.imports.length > 0) {
            summary += `Imports: ${parsed.imports.map((i) => i.module).join(', ')}\n`;
          }

          if (parsed.functions.length > 0) {
            summary += `Functions: ${parsed.functions.map((f) => f.name).join(', ')}\n`;
          }

          if (parsed.classes.length > 0) {
            summary += `Classes: ${parsed.classes.map((c) => c.name).join(', ')}\n`;
          }
        } catch (error) {
          // Ignore AST parsing errors for summary
        }
      }

      // Add first few non-empty lines as preview
      const previewLines = lines
        .filter((l) => l.trim().length > 0)
        .slice(0, 5)
        .join('\n');
      summary += `\nPreview:\n${previewLines}`;

      return {
        id: `${filePath}:summary`,
        content: summary,
        metadata: {
          filePath,
          startLine: 1,
          endLine: lines.length,
          type: 'file',
          language,
          isSummary: true,
        },
      };
    } catch (error) {
      console.error(`Error creating summary for ${filePath}:`, error);
      return null;
    }
  }
}
