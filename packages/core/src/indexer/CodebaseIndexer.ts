
/// CodebaseIndexer - Main indexer that orchestrates scanning, parsing, and chunking


import { FileScanner, type ScanOptions } from './FileScanner.js';
import { Chunker, type ChunkOptions } from './Chunker.js';
import type {
  FileInfo,
  ProjectInfo,
  EmbeddingDocument,
  IndexingEventCallback,
} from '../types/index.js';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface IndexerOptions {
  scan?: ScanOptions;
  chunk?: ChunkOptions;
  onProgress?: IndexingEventCallback;
}

export interface IndexResult {
  project: ProjectInfo;
  documents: EmbeddingDocument[];
  stats: {
    filesScanned: number;
    documentsCreated: number;
    duration: number;
  };
}

export class CodebaseIndexer {
  private projectRoot: string;
  private options: IndexerOptions;

  constructor(projectRoot: string, options: IndexerOptions = {}) {
    this.projectRoot = path.resolve(projectRoot);
    this.options = options;
  }

  async index(): Promise<IndexResult> {
    const startTime = Date.now();

    this.emit({ type: 'start', totalFiles: 0 });

    try {
      // Scan files
      const scanner = new FileScanner(this.projectRoot, this.options.scan);
      const files = await scanner.scan();

      this.emit({ type: 'start', totalFiles: files.length });

      // Get project info
      const project = await this.buildProjectInfo(files);

      //  Chunk files
      const chunker = new Chunker(this.options.chunk);
      const documents: EmbeddingDocument[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        this.emit({
          type: 'progress',
          current: i + 1,
          total: files.length,
          file: file.relativePath,
        });

        try {
          const chunks = await chunker.chunkFile(file.path, file.language);
          documents.push(...chunks);

          const summary = await chunker.createFileSummary(
            file.path,
            file.language
          );
          if (summary) {
            documents.push(summary);
          }
        } catch (error) {
          console.error(`Error chunking file ${file.path}:`, error);
        }
      }

      const duration = Date.now() - startTime;

      this.emit({
        type: 'complete',
        filesIndexed: files.length,
        duration,
      });

      return {
        project,
        documents,
        stats: {
          filesScanned: files.length,
          documentsCreated: documents.length,
          duration,
        },
      };
    } catch (error) {
      this.emit({
        type: 'error',
        error: error instanceof Error ? error : new Error(String(error)),
      });
      throw error;
    }
  }


  private async buildProjectInfo(files: FileInfo[]): Promise<ProjectInfo> {
    const projectName = path.basename(this.projectRoot);

    // Detect primary language
    const languageCounts: Record<string, number> = {};
    for (const file of files) {
      languageCounts[file.language] = (languageCounts[file.language] || 0) + 1;
    }

    const primaryLanguage = Object.entries(languageCounts).sort(
      ([, a], [, b]) => b - a
    )[0]?.[0] || 'unknown';

    const dependencies = await this.loadDependencies();

    const git = await this.loadGitInfo();

    return {
      rootPath: this.projectRoot,
      name: projectName,
      primaryLanguage,
      files,
      dependencies,
      git,
    };
  }


  private async loadDependencies(): Promise<Record<string, string>> {
    const dependencies: Record<string, string> = {};

    try {
      const packageJsonPath = path.join(this.projectRoot, 'package.json');
      const content = await fs.readFile(packageJsonPath, 'utf-8');
      const pkg = JSON.parse(content);

      if (pkg.dependencies) {
        Object.assign(dependencies, pkg.dependencies);
      }
      if (pkg.devDependencies) {
        Object.assign(dependencies, pkg.devDependencies);
      }
    } catch {
    }

    try {
      const requirementsPath = path.join(this.projectRoot, 'requirements.txt');
      const content = await fs.readFile(requirementsPath, 'utf-8');
      const lines = content.split('\n');

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const [pkg, version] = trimmed.split('==');
          dependencies[pkg] = version || '*';
        }
      }
    } catch {
    }

    try {
      const goModPath = path.join(this.projectRoot, 'go.mod');
      const content = await fs.readFile(goModPath, 'utf-8');
      const requireRegex = /require\s+([^\s]+)\s+([^\s]+)/g;
      let match;

      while ((match = requireRegex.exec(content)) !== null) {
        dependencies[match[1]] = match[2];
      }
    } catch {
    }

    return dependencies;
  }

 
  private async loadGitInfo() {
    try {
      const { execSync } = await import('child_process');

      // Check if git repo
      try {
        execSync('git rev-parse --git-dir', {
          cwd: this.projectRoot,
          stdio: 'pipe',
        });
      } catch {
        return undefined; // Not a git repo
      }

      // Get current branch
      const branch = execSync('git rev-parse --abbrev-ref HEAD', {
        cwd: this.projectRoot,
        encoding: 'utf-8',
      }).trim();

      // Get recent commits
      const logOutput = execSync(
        'git log -10 --pretty=format:"%H|%s|%an|%ad|" --date=iso',
        {
          cwd: this.projectRoot,
          encoding: 'utf-8',
        }
      );

      const recentCommits = logOutput
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => {
          const [hash, message, author, date] = line.split('|');
          return {
            hash,
            message,
            author,
            date: new Date(date),
            filesChanged: [], // Would need separate git command
          };
        });

      // Check if dirty
      const status = execSync('git status --porcelain', {
        cwd: this.projectRoot,
        encoding: 'utf-8',
      });
      const isDirty = status.trim().length > 0;

      return {
        branch,
        recentCommits,
        isDirty,
      };
    } catch (error) {
      console.warn('Could not load git info:', error);
      return undefined;
    }
  }


  private emit(event: Parameters<IndexingEventCallback>[0]): void {
    if (this.options.onProgress) {
      this.options.onProgress(event);
    }
  }
}
