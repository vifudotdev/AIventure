import { Injectable, OnDestroy } from '@angular/core';
import { EventBus } from '../../game/core/EventBus';
import { FunctionCallObject, CodeSnippetObject } from './model-types';
import { ModelBackend } from './model-backend.interface';

type ToolCallLike = {
  name?: string;
  args?: Record<string, unknown>;
  arguments?: Record<string, unknown>;
};

type VifuAiService = {
  turn?: (input: Record<string, unknown>) => Promise<unknown>;
  companion?: {
    turn?: (input: Record<string, unknown>) => Promise<unknown>;
  };
};

type VifuWindow = Window & {
  Vifu?: {
    services?: {
      ai?: VifuAiService;
    };
  };
};

@Injectable({
  providedIn: 'root'
})
export class VifuModelService implements ModelBackend, OnDestroy {
  private lastTool = '[]';
  private lastContext = '';

  constructor() {
    EventBus.on('model-tool-execution-result', this.handleToolResult, this);
  }

  ngOnDestroy() {
    EventBus.off('model-tool-execution-result', this.handleToolResult, this);
  }

  public reset() {
    this.lastTool = '[]';
    this.lastContext = '';
  }

  async handleToolResult(result: unknown) {
    const response = await this.invokeVifu({
      tools: this.parseTools(this.lastTool),
      context: this.lastContext,
      toolResult: result,
      source: 'aiventure'
    });
    this.emitToolCalls(response);
  }

  async *generateTextStream(tool_list: string, context: string, prompt: string) {
    this.lastTool = tool_list;
    this.lastContext = context;

    const response = await this.invokeVifu({
      tools: this.parseTools(tool_list),
      context,
      prompt,
      source: 'aiventure'
    });

    if (response) {
      if (this.emitToolCalls(response)) return;
      const text = this.textFromResponse(response);
      if (text) {
        yield text;
        return;
      }
    }

    const fallback = this.fallbackGeneration(tool_list, context, prompt);
    if (fallback instanceof FunctionCallObject) {
      EventBus.emit('model-function-call', fallback);
      yield `Function call: ${fallback.name}`;
    } else if (fallback instanceof CodeSnippetObject) {
      EventBus.emit('model-code-generated', fallback.code);
      yield 'Generated code snippet.';
    } else {
      yield fallback;
    }
  }

  async *generateHtmlStream(prompt: string, previousHtml: string = ''): AsyncGenerator<string> {
    const response = await this.invokeVifu({
      prompt,
      previousHtml,
      mode: 'html',
      source: 'aiventure'
    });
    const text = this.textFromResponse(response);
    if (text) {
      yield text;
      return;
    }
    yield `<html><body><main><h1>${this.escapeHtml(prompt)}</h1></main></body></html>`;
  }

  private async invokeVifu(input: Record<string, unknown>): Promise<unknown> {
    const ai = (window as VifuWindow).Vifu?.services?.ai;
    const turn = ai?.turn ?? ai?.companion?.turn;
    if (!turn) return null;
    try {
      return await turn(input);
    } catch (error) {
      console.warn('Vifu AI turn failed; using AIventure fallback.', error);
      return null;
    }
  }

  private parseTools(toolList: string): unknown[] {
    if (!toolList) return [];
    try {
      const parsed = JSON.parse(toolList);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private emitToolCalls(response: unknown): boolean {
    if (!response || typeof response !== 'object') return false;
    const record = response as Record<string, unknown>;
    const calls = this.toolCallsFrom(record);
    for (const call of calls) {
      EventBus.emit('model-function-call', {
        name: call.name,
        args: call.args ?? call.arguments ?? {}
      });
    }
    return calls.length > 0;
  }

  private toolCallsFrom(record: Record<string, unknown>): ToolCallLike[] {
    const single = record['functionCall'] ?? record['toolCall'];
    const multiple = record['functionCalls'] ?? record['toolCalls'];
    const values = [
      ...(Array.isArray(multiple) ? multiple : []),
      ...(single ? [single] : [])
    ];
    return values.filter((value): value is ToolCallLike => {
      return Boolean(value && typeof value === 'object' && typeof (value as ToolCallLike).name === 'string');
    });
  }

  private textFromResponse(response: unknown): string {
    if (typeof response === 'string') return response;
    if (!response || typeof response !== 'object') return '';
    const record = response as Record<string, unknown>;
    for (const key of ['text', 'content', 'message', 'output']) {
      const value = record[key];
      if (typeof value === 'string' && value.trim()) return value;
    }
    return '';
  }

  private fallbackGeneration(toolList: string, context: string, prompt: string) {
    const fcObj = new FunctionCallObject();
    let calling = '';
    const p = prompt.toLowerCase();

    if (p.includes('open ')) {
      calling = 'open_';
      if (p.includes(' red')) calling += 'red_door';
      else if (p.includes(' blue')) calling += 'blue_door';
      else if (p.includes(' yellow')) calling += 'yellow_door';
      else if (p.includes(' green')) calling += 'green_door';
    } else if (p.includes('light ')) {
      calling = 'light_';
      if (p.includes(' on')) calling += 'on';
      else if (p.includes(' off')) calling += 'off';
    } else if (p.includes("what's the code?")) {
      return context.includes('8452') ? 'The code is 8452!' : "I don't know the code.";
    } else if (p.includes(' code')) {
      const codeObj = new CodeSnippetObject();
      codeObj.code = 'return 5050;';
      return codeObj;
    }

    if (calling && toolList.includes(calling)) {
      fcObj.name = calling;
      return fcObj;
    }
    return 'Hello!';
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
