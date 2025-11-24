
// ASTParser - Parses code files into Abstract Syntax Trees. Extracts functions, classes, imports with tree-sitter


import Parser from 'tree-sitter';
import * as fs from 'fs/promises';
import type {
  FunctionInfo,
  ClassInfo,
  ImportInfo,
} from '../types/index.js';

// Language parsers (will be loaded dynamically)
let TypeScript: any;
let JavaScript: any;
let Python: any;

// Lazy load parsers to avoid startup cost
async function loadParsers() {
  if (!TypeScript) {
    TypeScript = (await import('tree-sitter-typescript')).typescript;
    JavaScript = (await import('tree-sitter-javascript')).default;
    Python = (await import('tree-sitter-python')).default;
  }
}

export interface ASTParseResult {
  functions: FunctionInfo[];
  classes: ClassInfo[];
  imports: ImportInfo[];
}

export class ASTParser {
  private parser: Parser;
  private language: string;

  constructor(language: string) {
    this.parser = new Parser();
    this.language = language;
  }


  async parseFile(filePath: string): Promise<ASTParseResult> {
    await loadParsers();

    this.setLanguage(this.language);

    const content = await fs.readFile(filePath, 'utf-8');
    const tree = this.parser.parse(content);

    const functions = this.extractFunctions(tree.rootNode, content);
    const classes = this.extractClasses(tree.rootNode, content);
    const imports = this.extractImports(tree.rootNode, content);

    return { functions, classes, imports };
  }

  async parseContent(content: string): Promise<ASTParseResult> {
    await loadParsers();
    this.setLanguage(this.language);

    const tree = this.parser.parse(content);

    const functions = this.extractFunctions(tree.rootNode, content);
    const classes = this.extractClasses(tree.rootNode, content);
    const imports = this.extractImports(tree.rootNode, content);

    return { functions, classes, imports };
  }

  private setLanguage(language: string): void {
    switch (language) {
      case 'typescript':
        this.parser.setLanguage(TypeScript);
        break;
      case 'javascript':
        this.parser.setLanguage(JavaScript);
        break;
      case 'python':
        this.parser.setLanguage(Python);
        break;
      default:
        throw new Error(`Unsupported language: ${language}`);
    }
  }

  private extractFunctions(
    node: Parser.SyntaxNode,
    content: string
  ): FunctionInfo[] {
    const functions: FunctionInfo[] = [];

    const traverse = (n: Parser.SyntaxNode) => {
      // TypeScript/JavaScript functions
      if (
        n.type === 'function_declaration' ||
        n.type === 'method_definition' ||
        n.type === 'arrow_function' ||
        n.type === 'function_expression'
      ) {
        const func = this.parseFunctionNode(n, content);
        if (func) functions.push(func);
      }

      if (n.type === 'function_definition') {
        const func = this.parsePythonFunction(n, content);
        if (func) functions.push(func);
      }

      for (const child of n.children) {
        traverse(child);
      }
    };

    traverse(node);
    return functions;
  }

  private extractClasses(
    node: Parser.SyntaxNode,
    content: string
  ): ClassInfo[] {
    const classes: ClassInfo[] = [];

    const traverse = (n: Parser.SyntaxNode) => {
      if (n.type === 'class_declaration' || n.type === 'class_definition') {
        const cls = this.parseClassNode(n, content);
        if (cls) classes.push(cls);
      }

      for (const child of n.children) {
        traverse(child);
      }
    };

    traverse(node);
    return classes;
  }

  private extractImports(
    node: Parser.SyntaxNode,
    content: string
  ): ImportInfo[] {
    const imports: ImportInfo[] = [];

    const traverse = (n: Parser.SyntaxNode) => {
      if (this.language === 'python') {
        // Python imports
        if (n.type === 'import_statement' || n.type === 'import_from_statement') {
          const imp = this.parsePythonImport(n, content);
          if (imp) imports.push(imp);
        }
      } else {
        // TypeScript/JavaScript imports
        if (n.type === 'import_statement') {
          const imp = this.parseImportNode(n, content);
          if (imp) imports.push(imp);
        }
      }

      for (const child of n.children) {
        traverse(child);
      }
    };

    traverse(node);
    return imports;
  }

 
  private parseFunctionNode(
    node: Parser.SyntaxNode,
    content: string
  ): FunctionInfo | null {
    try {
      const nameNode = node.childForFieldName('name');
      const name = nameNode ? content.substring(nameNode.startIndex, nameNode.endIndex) : 'anonymous';

      const paramsNode = node.childForFieldName('parameters');
      const params = paramsNode
        ? this.extractParameters(paramsNode, content)
        : [];

      const returnTypeNode = node.childForFieldName('return_type');
      const returnType = returnTypeNode
        ? content.substring(returnTypeNode.startIndex, returnTypeNode.endIndex)
        : undefined;

      const isAsync = node.text.includes('async');
      const isExported = this.isExported(node);

      const docstring = this.extractDocstring(node, content);

      return {
        name,
        startLine: node.startPosition.row + 1,
        endLine: node.endPosition.row + 1,
        params,
        returnType,
        docstring,
        isAsync,
        isExported,
      };
    } catch (error) {
      console.error('Error parsing function node:', error);
      return null;
    }
  }

  
  private parsePythonFunction(
    node: Parser.SyntaxNode,
    content: string
  ): FunctionInfo | null {
    try {
      const nameNode = node.childForFieldName('name');
      const name = nameNode
        ? content.substring(nameNode.startIndex, nameNode.endIndex)
        : 'anonymous';

      const paramsNode = node.childForFieldName('parameters');
      const params = paramsNode
        ? this.extractPythonParameters(paramsNode, content)
        : [];

      const returnTypeNode = node.childForFieldName('return_type');
      const returnType = returnTypeNode
        ? content.substring(returnTypeNode.startIndex, returnTypeNode.endIndex)
        : undefined;

      const isAsync = node.text.startsWith('async');

      const docstring = this.extractPythonDocstring(node, content);

      return {
        name,
        startLine: node.startPosition.row + 1,
        endLine: node.endPosition.row + 1,
        params,
        returnType,
        docstring,
        isAsync,
        isExported: true,
      };
    } catch (error) {
      console.error('Error parsing Python function:', error);
      return null;
    }
  }

 
  private parseClassNode(
    node: Parser.SyntaxNode,
    content: string
  ): ClassInfo | null {
    try {
      const nameNode = node.childForFieldName('name');
      const name = nameNode
        ? content.substring(nameNode.startIndex, nameNode.endIndex)
        : 'Anonymous';

      const methods: FunctionInfo[] = [];
      const bodyNode = node.childForFieldName('body');
      if (bodyNode) {
        for (const child of bodyNode.children) {
          if (child.type === 'method_definition' || child.type === 'function_definition') {
            const method =
              this.language === 'python'
                ? this.parsePythonFunction(child, content)
                : this.parseFunctionNode(child, content);
            if (method) methods.push(method);
          }
        }
      }

      const isExported = this.isExported(node);

      return {
        name,
        startLine: node.startPosition.row + 1,
        endLine: node.endPosition.row + 1,
        methods,
        properties: [], // TODO: Extract properties
        isExported,
      };
    } catch (error) {
      console.error('Error parsing class node:', error);
      return null;
    }
  }

  private parseImportNode(
    node: Parser.SyntaxNode,
    content: string
  ): ImportInfo | null {
    try {
      const sourceNode = node.childForFieldName('source');
      const module = sourceNode
        ? content
            .substring(sourceNode.startIndex, sourceNode.endIndex)
            .replace(/['"]/g, '')
        : '';

      const symbols: string[] = [];
      let type: 'named' | 'default' | 'namespace' = 'named';

      // Extract imported symbols
      for (const child of node.children) {
        if (child.type === 'import_clause') {
          for (const spec of child.children) {
            if (spec.type === 'identifier') {
              symbols.push(
                content.substring(spec.startIndex, spec.endIndex)
              );
              type = 'default';
            } else if (spec.type === 'named_imports') {
              for (const namedSpec of spec.children) {
                if (namedSpec.type === 'import_specifier') {
                  const id = namedSpec.childForFieldName('name');
                  if (id) {
                    symbols.push(
                      content.substring(id.startIndex, id.endIndex)
                    );
                  }
                }
              }
            } else if (spec.type === 'namespace_import') {
              type = 'namespace';
              const id = spec.childForFieldName('name');
              if (id) {
                symbols.push(content.substring(id.startIndex, id.endIndex));
              }
            }
          }
        }
      }

      const isExternal = !module.startsWith('.') && !module.startsWith('/');

      return { module, symbols, type, isExternal };
    } catch (error) {
      console.error('Error parsing import node:', error);
      return null;
    }
  }

 
  private parsePythonImport(
    node: Parser.SyntaxNode,
    content: string
  ): ImportInfo | null {
    try {
      let module = '';
      const symbols: string[] = [];

      if (node.type === 'import_statement') {
        const nameNode = node.childForFieldName('name');
        if (nameNode) {
          module = content.substring(nameNode.startIndex, nameNode.endIndex);
          symbols.push(module);
        }
      } else if (node.type === 'import_from_statement') {
        const moduleNode = node.childForFieldName('module_name');
        if (moduleNode) {
          module = content.substring(
            moduleNode.startIndex,
            moduleNode.endIndex
          );
        }

        // Extract imported names
        for (const child of node.children) {
          if (child.type === 'dotted_name' || child.type === 'identifier') {
            symbols.push(content.substring(child.startIndex, child.endIndex));
          }
        }
      }

      const isExternal = !module.startsWith('.');

      return {
        module,
        symbols,
        type: 'named',
        isExternal,
      };
    } catch (error) {
      console.error('Error parsing Python import:', error);
      return null;
    }
  }

  private extractParameters(
    paramsNode: Parser.SyntaxNode,
    content: string
  ): string[] {
    const params: string[] = [];

    for (const child of paramsNode.children) {
      if (
        child.type === 'required_parameter' ||
        child.type === 'optional_parameter'
      ) {
        const nameNode = child.childForFieldName('pattern') || child.children[0];
        if (nameNode) {
          params.push(content.substring(nameNode.startIndex, nameNode.endIndex));
        }
      }
    }

    return params;
  }

  private extractPythonParameters(
    paramsNode: Parser.SyntaxNode,
    content: string
  ): string[] {
    const params: string[] = [];

    for (const child of paramsNode.children) {
      if (child.type === 'identifier') {
        params.push(content.substring(child.startIndex, child.endIndex));
      }
    }

    return params;
  }

  
  // Check if node is exported
  
  private isExported(node: Parser.SyntaxNode): boolean {
    let current = node.parent;
    while (current) {
      if (current.type === 'export_statement') {
        return true;
      }
      current = current.parent;
    }
    return false;
  }


  private extractDocstring(
    node: Parser.SyntaxNode,
    content: string
  ): string | undefined {
    // Look for comment before the node
    let current = node.previousSibling;
    while (current && current.type === 'comment') {
      const comment = content.substring(current.startIndex, current.endIndex);
      if (comment.startsWith('/**')) {
        return comment;
      }
      current = current.previousSibling;
    }
    return undefined;
  }


  private extractPythonDocstring(
    node: Parser.SyntaxNode,
    content: string
  ): string | undefined {
    const bodyNode = node.childForFieldName('body');
    if (bodyNode && bodyNode.children.length > 0) {
      const firstChild = bodyNode.children[0];
      if (firstChild.type === 'expression_statement' && firstChild.children.length > 0) {
        const stringNode = firstChild.children[0];
        if (stringNode && stringNode.type === 'string') {
          return content
            .substring(stringNode.startIndex, stringNode.endIndex)
            .replace(/^["']|["']$/g, '');
        }
      }
    }
    return undefined;
  }
}
