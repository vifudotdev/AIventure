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

import { Injectable, OnDestroy } from '@angular/core';
import { EventBus } from '../../game/core/EventBus';
import { ModelBackend } from './model-backend.interface';
import { FunctionCallObject, CodeSnippetObject } from './model-types';
import { LogService } from './log.service';

@Injectable({
  providedIn: 'root'
})
export class OllamaService implements ModelBackend, OnDestroy {
  private history: any[] = [];
  private apiUrl = 'http://localhost:11434/api/chat';
  private model = 'gemma3:4b';
  private lastTool: string = "[]";

  constructor(private logService: LogService) {
    EventBus.on('model-tool-execution-result', this.handleToolResult, this);
  }

  ngOnDestroy() {
    EventBus.off('model-tool-execution-result', this.handleToolResult, this);
  }

  public reset() {
    this.history = [];
    this.lastTool = "[]";
  }

  private constructTools(tool_list: string) {
    if (!tool_list) return undefined;

    try {
      let functionObjs = JSON.parse(tool_list);
      if (functionObjs.length === 0) return undefined;

      return functionObjs.map((obj: any) => ({
        type: 'function',
        function: obj
      }));
    } catch (e) {
      console.warn("Failed to parse context for tools:", e);
    }
    return undefined;
  }

  private constructRequestBody(tool_list: string) {
    const requestBody: any = {
      model: this.model,
      messages: this.history,
      stream: true
    };

    const tools = this.constructTools(tool_list);
    if (tools) {
      requestBody.tools = tools;
    }
    return JSON.stringify(requestBody);
  }

  async handleToolResult(result: any) {
    // Note: This logic assumes result.output is the result.
    this.history.push({
      role: 'tool',
      content: JSON.stringify(result.output),
    });

    try {
        const response = await fetch(this.apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: this.constructRequestBody(this.lastTool)
        });

        if (!response.body) return;
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        let accumulatedContent = "";
        let accumulatedToolCalls: any[] = [];

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (!line.trim()) continue;
                try {
                    const json = JSON.parse(line);
                    if (json.done) {
                        const finalMsg: any = { role: 'assistant', content: accumulatedContent };
                        if (accumulatedToolCalls.length > 0) {
                            finalMsg.tool_calls = accumulatedToolCalls;
                        }
                        this.history.push(finalMsg);
                        return;
                    }

                    if (json.message) {
                        if (json.message.content) {
                            if (accumulatedContent === "") {
                                this.logService.addLog(`Ollama: ${json.message.content}`);
                            } else {
                                this.logService.appendLog(json.message.content);
                            }
                            accumulatedContent += json.message.content;
                        }

                        if (json.message.tool_calls) {
                             json.message.tool_calls.forEach((tc: any) => {
                                 accumulatedToolCalls.push(tc);
                                 const functionCall = {
                                     name: tc.function.name,
                                     args: tc.function.arguments
                                 };
                                 EventBus.emit('model-function-call', functionCall);
                             });
                        }
                    }
                } catch (e) {
                    console.error("Error parsing ollama chunk", e);
                }
            }
        }

    } catch (e) {
        console.error("Error in handleToolResult", e);
    }
  }

  async *generateTextStream(tool_list: string, context: string, prompt: string): AsyncGenerator<string> {
    this.lastTool = tool_list;

    let userMessage = prompt;
    if (context) {
        userMessage = `Context: ${context}\nUser: ${prompt}`;
    }

    this.history.push({ role: 'user', content: userMessage });

    try {
        const response = await fetch(this.apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: this.constructRequestBody(tool_list)
        });

        if (!response.body) throw new Error("No response body");
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        let accumulatedContent = "";
        let accumulatedToolCalls: any[] = [];

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (!line.trim()) continue;
                try {
                    const json = JSON.parse(line);
                    if (json.done) {
                         const finalMsg: any = { role: 'assistant', content: accumulatedContent };
                         if (accumulatedToolCalls.length > 0) {
                             finalMsg.tool_calls = accumulatedToolCalls;
                         }
                         this.history.push(finalMsg);
                         break;
                    }

                    if (json.message) {
                        if (json.message.content) {
                            accumulatedContent += json.message.content;
                            yield json.message.content;
                        }

                        if (json.message.tool_calls) {
                             json.message.tool_calls.forEach((tc: any) => {
                                 accumulatedToolCalls.push(tc);
                                 const functionCall = {
                                     name: tc.function.name,
                                     args: tc.function.arguments
                                 };
                                 EventBus.emit('model-function-call', functionCall);
                             });
                             for (const tc of json.message.tool_calls) {
                                  yield `Function call: ${tc.function.name}`;
                             }
                        }
                    }
                } catch (e) {
                    console.error("Error parsing ollama chunk", e);
                }
            }
        }
    } catch (e) {
        console.error("Error generating text stream", e);
        yield "Error connecting to Ollama.";
    }
  }

  async *generateHtmlStream(prompt: string, previousHtml: string = ""): AsyncGenerator<string> {
    let systemInstruction = `You are an expert web developer. Create a single HTML file containing CSS and JS based on the following request. Return ONLY the raw HTML code, no markdown formatting (no \`\`\`html wrapper).`;

    if (previousHtml) {
        systemInstruction += `\n\nUpdate the following HTML based on the user's request. Return the FULL updated HTML file.\n\nExisting HTML:\n${previousHtml}`;
    }

    try {
        const response = await fetch(this.apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: this.model,
                messages: [
                    { role: 'system', content: systemInstruction },
                    { role: 'user', content: prompt }
                ],
                stream: true
            })
        });

        if (!response.body) throw new Error("No response body");
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (!line.trim()) continue;
                try {
                    const json = JSON.parse(line);
                    if (json.done) return;

                    const content = json.message?.content;
                    if (content) {
                        yield content;
                    }
                } catch (e) {
                    console.error("Error parsing ollama chunk", e);
                }
            }
        }
    } catch (e) {
        console.error("Error generating HTML:", e);
        yield "<html><body><h1>Error generating HTML</h1></body></html>";
    }
  }
}
