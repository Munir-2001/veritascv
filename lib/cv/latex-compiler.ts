/**
 * LaTeX Compilation Service
 * 
 * Handles compilation of LaTeX templates to PDF
 * Supports multiple compilation methods:
 * 1. Docker with LaTeX (recommended for production)
 * 2. Pandoc (LaTeX → HTML → PDF)
 * 3. External service (Overleaf API, etc.)
 */

import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { randomUUID } from 'crypto';

const execAsync = promisify(exec);

export interface CompilationOptions {
  method?: 'docker' | 'pandoc' | 'service';
  dockerImage?: string;
  pandocPath?: string;
  outputDir?: string;
}

export interface CompilationResult {
  success: boolean;
  pdfPath?: string;
  pdfBuffer?: Buffer;
  error?: string;
  logs?: string;
}

/**
 * Compile LaTeX to PDF
 */
export async function compileLatexToPDF(
  latexContent: string,
  options: CompilationOptions = {}
): Promise<CompilationResult> {
  const method = options.method || detectAvailableMethod();
  
  switch (method) {
    case 'docker':
      return compileWithDocker(latexContent, options);
    case 'pandoc':
      return compileWithPandoc(latexContent, options);
    case 'service':
      return compileWithService(latexContent, options);
    default:
      // Fallback: try pandoc first, then docker
      try {
        return await compileWithPandoc(latexContent, options);
      } catch (error) {
        console.warn('[LaTeX] Pandoc failed, trying Docker...');
        return await compileWithDocker(latexContent, options);
      }
  }
}

/**
 * Detect available compilation method
 */
function detectAvailableMethod(): 'docker' | 'pandoc' | 'service' {
  // Check for pandoc first (easier to install)
  try {
    execSync('pandoc --version');
    return 'pandoc';
  } catch {
    // Check for docker
    try {
      execSync('docker --version');
      return 'docker';
    } catch {
      return 'service';
    }
  }
}

/**
 * Compile using Docker with LaTeX
 */
async function compileWithDocker(
  latexContent: string,
  options: CompilationOptions
): Promise<CompilationResult> {
  const workDir = options.outputDir || path.join(process.cwd(), 'tmp', 'latex', randomUUID());
  const texFile = path.join(workDir, 'resume.tex');
  const pdfFile = path.join(workDir, 'resume.pdf');
  const dockerImage = options.dockerImage || 'texlive/texlive:latest';
  
  try {
    // Create work directory
    if (!fs.existsSync(workDir)) {
      fs.mkdirSync(workDir, { recursive: true });
    }
    
    // Write LaTeX file
    fs.writeFileSync(texFile, latexContent, 'utf-8');
    
    // Compile using Docker
    const compileCommand = `docker run --rm -v "${workDir}:/workdir" ${dockerImage} pdflatex -interaction=nonstopmode -output-directory=/workdir /workdir/resume.tex`;
    
    const { stdout, stderr } = await execAsync(compileCommand);
    
    // Check if PDF was created
    if (fs.existsSync(pdfFile)) {
      const pdfBuffer = fs.readFileSync(pdfFile);
      
      // Cleanup
      cleanupDirectory(workDir);
      
      return {
        success: true,
        pdfPath: pdfFile,
        pdfBuffer,
        logs: stdout + stderr,
      };
    } else {
      cleanupDirectory(workDir);
      return {
        success: false,
        error: 'PDF was not generated',
        logs: stdout + stderr,
      };
    }
  } catch (error: any) {
    cleanupDirectory(workDir);
    return {
      success: false,
      error: error.message,
      logs: error.stdout + error.stderr,
    };
  }
}

/**
 * Compile using Pandoc (LaTeX → HTML → PDF)
 * Note: This requires pandoc and a PDF engine (wkhtmltopdf, weasyprint, or prince)
 */
async function compileWithPandoc(
  latexContent: string,
  options: CompilationOptions
): Promise<CompilationResult> {
  const workDir = options.outputDir || path.join(process.cwd(), 'tmp', 'latex', randomUUID());
  const texFile = path.join(workDir, 'resume.tex');
  const pdfFile = path.join(workDir, 'resume.pdf');
  const pandocPath = options.pandocPath || 'pandoc';
  
  try {
    // Create work directory
    if (!fs.existsSync(workDir)) {
      fs.mkdirSync(workDir, { recursive: true });
    }
    
    // Write LaTeX file
    fs.writeFileSync(texFile, latexContent, 'utf-8');
    
    // Convert LaTeX → PDF using pandoc
    // Note: Pandoc can convert LaTeX to PDF if a PDF engine is available
    const command = `${pandocPath} "${texFile}" -o "${pdfFile}" --pdf-engine=pdflatex`;
    
    const { stdout, stderr } = await execAsync(command);
    
    // Check if PDF was created
    if (fs.existsSync(pdfFile)) {
      const pdfBuffer = fs.readFileSync(pdfFile);
      
      // Cleanup
      cleanupDirectory(workDir);
      
      return {
        success: true,
        pdfPath: pdfFile,
        pdfBuffer,
        logs: stdout + stderr,
      };
    } else {
      cleanupDirectory(workDir);
      return {
        success: false,
        error: 'PDF was not generated by pandoc',
        logs: stdout + stderr,
      };
    }
  } catch (error: any) {
    cleanupDirectory(workDir);
    return {
      success: false,
      error: error.message,
      logs: error.stdout + error.stderr,
    };
  }
}

/**
 * Compile using external service (e.g., Overleaf API)
 * This is a placeholder - implement based on your service
 */
async function compileWithService(
  latexContent: string,
  options: CompilationOptions
): Promise<CompilationResult> {
  // TODO: Implement external service integration
  // Example: Overleaf API, LaTeX.Online, etc.
  
  return {
    success: false,
    error: 'External service compilation not implemented yet',
  };
}

/**
 * Cleanup temporary directory
 */
function cleanupDirectory(dir: string): void {
  try {
    if (fs.existsSync(dir)) {
      fs.readdirSync(dir).forEach(file => {
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isFile()) {
          fs.unlinkSync(filePath);
        }
      });
      fs.rmdirSync(dir);
    }
  } catch (error) {
    console.warn(`[LaTeX] Failed to cleanup directory ${dir}:`, error);
  }
}

/**
 * Helper to execute command synchronously (for detection)
 */
function execSync(command: string): void {
  try {
    require('child_process').execSync(command, { stdio: 'ignore' });
  } catch {
    throw new Error('Command failed');
  }
}

