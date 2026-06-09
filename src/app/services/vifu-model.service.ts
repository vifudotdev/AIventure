import { Injectable, Injector, OnDestroy } from '@angular/core';
import { EventBus } from '../../game/core/EventBus';
import { ModelBackend } from './model-backend.interface';
import { LmStudioService } from './lmstudio.service';

type VifuWindow = Window & {
  Vifu?: {
    ai?: {
      chat?: (input: Record<string, unknown>) => Promise<any>;
      generateText?: (input: Record<string, unknown>) => Promise<{
        content?: string;
        text?: string;
        toolCalls?: Array<{ name?: string }>;
      }>;
    };
  };
};

@Injectable({
  providedIn: 'root'
})
export class VifuModelService implements ModelBackend, OnDestroy {
  private history: any[] = [];
  private pendingToolResults: Array<(result: any) => void> = [];
  private fallbackBackend?: LmStudioService;
  private fallbackActive = false;

  constructor(private injector: Injector) {
    EventBus.on('model-tool-execution-result', this.handleToolResult, this);
  }

  ngOnDestroy() {
    EventBus.off('model-tool-execution-result', this.handleToolResult, this);
    this.fallbackBackend?.ngOnDestroy();
  }

  public reset() {
    this.history = [];
    this.pendingToolResults = [];
    this.fallbackBackend?.reset();
  }

  private vifuAi() {
    return (window as VifuWindow).Vifu?.ai ?? null;
  }

  private fallback() {
    this.fallbackActive = true;
    this.fallbackBackend ??= this.injector.get(LmStudioService);
    return this.fallbackBackend;
  }

  private constructVifuTools(tool_list: string) {
    if (!tool_list) return undefined;

    try {
      const functionObjs = JSON.parse(tool_list);
      if (!Array.isArray(functionObjs) || functionObjs.length === 0) return undefined;

      const tools: Record<string, any> = {};
      for (const obj of functionObjs) {
        if (!obj?.name) continue;
        tools[obj.name] = {
          description: obj.description,
          parameters: obj.parameters,
          execute: (args: Record<string, unknown>) => this.executeVifuTool(obj.name, args)
        };
      }
      return Object.keys(tools).length > 0 ? tools : undefined;
    } catch (e) {
      console.warn("Failed to parse Vifu tool list:", e);
    }
    return undefined;
  }

  private executeVifuTool(name: string, args: Record<string, unknown>) {
    return new Promise((resolve) => {
      this.pendingToolResults.push((result) => resolve(result?.output ?? result));
      EventBus.emit('model-function-call', { name, args });
    });
  }

  private handleToolResult(result: any) {
    if (this.fallbackActive) return;

    const pendingToolResult = this.pendingToolResults.shift();
    if (pendingToolResult) pendingToolResult(result);
  }

  async *generateTextStream(tool_list: string, context: string, prompt: string): AsyncGenerator<string> {
    const generateText = this.vifuAi()?.generateText;
    if (this.fallbackActive || !generateText) {
      yield* this.fallback().generateTextStream(tool_list, context, prompt);
      return;
    }

    const userMessage = context ? `Context: ${context}\n${prompt ? 'User: ' + prompt : ''}` : prompt;
    this.history.push({ role: 'user', content: userMessage });

    try {
      const result = await generateText({
        messages: this.history,
        tools: this.constructVifuTools(tool_list)
      });
      const content = result.content || result.text || '';
      if (content) {
        this.history.push({ role: 'assistant', content });
        yield content;
      }
      if (Array.isArray(result.toolCalls)) {
        for (const toolCall of result.toolCalls) {
          if (toolCall.name) yield `Function call: ${toolCall.name}`;
        }
      }
    } catch (error) {
      console.warn('Vifu AI failed; falling back to LM Studio.', error);
      yield* this.fallback().generateTextStream(tool_list, context, prompt);
    }
  }

  async *generateHtmlStream(prompt: string, previousHtml: string = ""): AsyncGenerator<string> {
    const chat = this.vifuAi()?.chat;
    if (this.fallbackActive || !chat) {
      yield* this.fallback().generateHtmlStream(prompt, previousHtml);
      return;
    }

    let systemInstruction = `You are an expert web developer. Create a single HTML file containing CSS and JS based on the following request. Return ONLY the raw HTML code, no markdown formatting (no \`\`\`html wrapper).`;

    if (previousHtml) {
      systemInstruction += `\n\nUpdate the following HTML based on the user's request. Return the FULL updated HTML file.\n\nExisting HTML:\n${previousHtml}`;
    }

    try {
      const response = await chat({
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: prompt }
        ]
      });
      const content = response?.choices?.[0]?.message?.content;
      if (typeof content === 'string' && content.trim()) {
        yield content;
        return;
      }
    } catch (error) {
      console.warn('Vifu AI HTML generation failed; falling back to LM Studio.', error);
    }

    yield* this.fallback().generateHtmlStream(prompt, previousHtml);
  }
}
