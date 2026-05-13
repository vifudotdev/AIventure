/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// types.ts (Optional)
export interface ExecutionResult {
  success: boolean;
  output?: any;
  logs: string[];
  error?: string;
}

// 1. Define worker code as a raw string to avoid TS compilation issues
// We write plain JavaScript here.
const WORKER_CODE = `
  self.onmessage = async (e) => {
    const code = e.data;
    const logs = [];

    // Capture Console Logs
    const originalLog = console.log;
    console.log = (...args) => {
      // Convert args to strings
      logs.push(args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' '));
    };

    try {
      // AsyncFunction constructor trick
      // This works in all modern browsers (Edge, Chrome, FF, Safari)
      const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
      const func = new AsyncFunction(code);
      
      const result = await func();

      self.postMessage({ 
        success: true, 
        output: result, 
        logs: logs 
      });

    } catch (err) {
      self.postMessage({ 
        success: false, 
        error: err.message, 
        logs: logs 
      });
    }
  };
`;

export class CodeExecutor {
  private worker: Worker | null = null;
  private timeoutId: any = null;
  private readonly TIMEOUT_MS = 3000; 

  public async runCode(codeContent: string): Promise<ExecutionResult> {
    return new Promise((resolve) => {
      this.terminate();

      // 2. Create the Worker from the string constant
      const blob = new Blob([WORKER_CODE], { type: 'application/javascript' });
      const workerUrl = URL.createObjectURL(blob);
      this.worker = new Worker(workerUrl);

      // Guard against infinite loops
      this.timeoutId = setTimeout(() => {
        this.terminate();
        resolve({
          success: false,
          logs: [],
          error: 'Execution timed out (infinite loop detected)'
        });
      }, this.TIMEOUT_MS);

      this.worker.onmessage = (e: MessageEvent) => {
        clearTimeout(this.timeoutId);
        resolve(e.data);
        this.terminate();
      };

      this.worker.onerror = (e: ErrorEvent) => {
        clearTimeout(this.timeoutId);
        resolve({
          success: false,
          logs: [],
          error: `Worker Error: ${e.message}`
        });
        this.terminate();
      };

      this.worker.postMessage(codeContent);
    });
  }

  private terminate() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }
}