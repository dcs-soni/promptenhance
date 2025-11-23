
// FileScanner scans project directory and finds relevant files 
// Respects .gitignore patterns and filters by language
 

import { glob } from 'glob';
import ignore from 'ignore';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import type { FileInfo } from '../types/index.js';

export interface ScanOptions {
  include?: string[];
  exclude?: string[];
  followSymlinks?: boolean;
  maxFileSize?: number;
}

const DEFAULT_INCLUDE = [
  '**/*.ts',
  '**/*.tsx',
  '**/*.js',
  '**/*.jsx',
  '**/*.py',
  '**/*.java',
  '**/*.go',
  '**/*.rs',
  '**/*.c',
  '**/*.cpp',
  '**/*.h',
  '**/*.hpp',
];

const DEFAULT_EXCLUDE = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/.git/**',
  '**/coverage/**',
  '**/*.test.*',
  '**/*.spec.*',
  '**/*.min.js',
];

const LANGUAGE_MAP: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.py': 'python',
  '.java': 'java',
  '.go': 'go',
  '.rs': 'rust',
  '.c': 'c',
  '.cpp': 'cpp',
  '.h': 'c',
  '.hpp': 'cpp',
  '.rb': 'ruby',
  '.php': 'php',
  '.swift': 'swift',
  '.kt': 'kotlin',
};

export class FileScanner {
  private projectRoot: string;
  private options: Required<ScanOptions>;
  private ignoreFilter: ReturnType<typeof ignore> | null = null;

  constructor(projectRoot: string, options: ScanOptions = {}) {
    this.projectRoot = path.resolve(projectRoot);
    this.options = {
      include: options.include || DEFAULT_INCLUDE,
      exclude: options.exclude || DEFAULT_EXCLUDE,
      followSymlinks: options.followSymlinks ?? false,
      maxFileSize: options.maxFileSize ?? 1024 * 1024, // 1MB
    };
  }


  async scan(): Promise<FileInfo[]> {
    await this.loadGitignore();

    const files = await this.findFiles();

    const fileInfos = await Promise.all(
      files.map((file) => this.processFile(file))
    );

    return fileInfos.filter((f): f is FileInfo => f !== null);
  }


  private async loadGitignore(): Promise<void> {
    const gitignorePath = path.join(this.projectRoot, '.gitignore');

    try {
      const content = await fs.readFile(gitignorePath, 'utf-8');
      this.ignoreFilter = ignore().add(content);
    } catch (error) {
      this.ignoreFilter = null;
    }
  }


  private async findFiles(): Promise<string[]> {
    const allFiles: Set<string> = new Set();

    // Collect files from all include patterns
    for (const pattern of this.options.include) {
      const files = await glob(pattern, {
        cwd: this.projectRoot,
        absolute: true,
        nodir: true,
        follow: this.options.followSymlinks,
        ignore: this.options.exclude,
      });

      files.forEach((f) => allFiles.add(f));
    }

    // Filter using .gitignore
    const filtered = Array.from(allFiles).filter((file) => {
      const relativePath = path.relative(this.projectRoot, file);
      return !this.shouldIgnoreFile(relativePath);
    });

    return filtered;
  }


  private shouldIgnoreFile(relativePath: string): boolean {
    if (!this.ignoreFilter) return false;
    return this.ignoreFilter.ignores(relativePath);
  }

  private async processFile(filePath: string): Promise<FileInfo | null> {
    try {
      const stats = await fs.stat(filePath);

      if (stats.size > this.options.maxFileSize) {
        console.warn(`Skipping large file: ${filePath} (${stats.size} bytes)`);
        return null;
      }

      if (!stats.isFile()) {
        return null;
      }

      const relativePath = path.relative(this.projectRoot, filePath);
      const ext = path.extname(filePath);
      const language = LANGUAGE_MAP[ext] || 'unknown';

      if (language === 'unknown') {
        return null;
      }

      // Read file content to extract imports/exports
      const content = await fs.readFile(filePath, 'utf-8');
      const { imports, exports } = this.extractImportsExports(content, language);

      // Generate content hash for change detection
      const hash = this.generateHash(content);

      return {
        path: filePath,
        relativePath,
        language,
        size: stats.size,
        lastModified: stats.mtime,
        imports,
        exports,
        hash,
      };
    } catch (error) {
      console.error(`Error processing file ${filePath}:`, error);
      return null;
    }
  }

  
  // Extract imports and exports from file content. This is a simple regex-based approach; AST parsing will be more accurate
   
  private extractImportsExports(
    content: string,
    language: string
  ): { imports: string[]; exports: string[] } {
    const imports: string[] = [];
    const exports: string[] = [];

    if (language === 'typescript' || language === 'javascript') {
      const importRegex = /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+)?['"]([^'"]+)['"]/g;
      let match;
      while ((match = importRegex.exec(content)) !== null) {
        imports.push(match[1]);
      }

      const exportRegex = /export\s+(?:default\s+)?(?:class|function|const|let|var|interface|type)\s+(\w+)/g;
      while ((match = exportRegex.exec(content)) !== null) {
        exports.push(match[1]);
      }
    } else if (language === 'python') {
      const importRegex = /(?:from\s+(\S+)\s+)?import\s+([^#\n]+)/g;
      let match;
      while ((match = importRegex.exec(content)) !== null) {
        const module = match[1] || match[2].split(',')[0].trim();
        imports.push(module);
      }

      const defRegex = /^(?:def|class)\s+(\w+)/gm;
      while ((match = defRegex.exec(content)) !== null) {
        exports.push(match[1]);
      }
    }

    return { imports, exports };
  }

  private generateHash(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  static getLanguage(filePath: string): string {
    const ext = path.extname(filePath);
    return LANGUAGE_MAP[ext] || 'unknown';
  }

  static isSupported(filePath: string): boolean {
    const ext = path.extname(filePath);
    return ext in LANGUAGE_MAP;
  }
}
