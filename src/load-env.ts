import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

export function loadEnvFile(filePath: string = '.env'): void {
  try {
    // Get the directory of the current module (ES modules compatible)
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    
    // Try multiple possible locations for the .env file
    const possiblePaths = [
      filePath, // absolute path if provided
      join(process.cwd(), filePath),
      join(__dirname, '..', filePath),
      join(__dirname, filePath),
      join(process.cwd(), '..', filePath)
    ];
    
    let envContent = '';
    let envPath = '';
    
    for (const path of possiblePaths) {
      try {
        envContent = readFileSync(path, 'utf8');
        envPath = path;
        break;
      } catch (e) {
        // Continue to next path
      }
    }
    
    if (!envContent) {
      console.error('Could not find .env file in any of the expected locations');
      return;
    }
    
    envContent.split('\n').forEach(line => {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const [key, ...valueParts] = trimmedLine.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').trim();
          if (!process.env[key]) {
            process.env[key] = value;
          }
        }
      }
    });
  } catch (error) {
    // Silently ignore if .env file doesn't exist
  }
}
