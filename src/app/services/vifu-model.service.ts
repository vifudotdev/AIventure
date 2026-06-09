import { Injectable, OnDestroy } from '@angular/core';
import { EventBus } from '../../game/core/EventBus';
import { ModelBackend } from './model-backend.interface';

type VifuWindow = Window & {
  Vifu?: {
    ready?: () => Promise<unknown>;
    status?: () => { hostConnected?: boolean; transport?: string };
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
  private hostReadyAttempt?: Promise<void>;

  constructor() {
    EventBus.on('model-tool-execution-result', this.handleToolResult, this);
  }

  ngOnDestroy() {
    EventBus.off('model-tool-execution-result', this.handleToolResult, this);
  }

  public reset() {
    this.history = [];
    this.pendingToolResults = [];
  }

  private vifuAi() {
    return (window as VifuWindow).Vifu?.ai ?? null;
  }

  private async waitForVifuHost() {
    const vifu = (window as VifuWindow).Vifu;
    if (!vifu?.ready) return;
    this.hostReadyAttempt ??= Promise.race([
      vifu.ready().then(() => undefined),
      new Promise<void>((resolve) => setTimeout(resolve, 750)),
    ]).catch(() => undefined);
    await this.hostReadyAttempt;
  }

  private parseTools(tool_list: string): Array<{ name: string; description?: string; parameters?: any }> {
    if (!tool_list) return [];
    try {
      const parsed = JSON.parse(tool_list);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((tool): tool is { name: string; description?: string; parameters?: any } => (
        typeof tool?.name === 'string' && tool.name.trim().length > 0
      ));
    } catch (e) {
      console.warn("Failed to parse Vifu tool list:", e);
      return [];
    }
  }

  private words(value: string): string[] {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .split(/\s+/)
      .filter(Boolean);
  }

  private deterministicToolCall(tool_list: string, context: string, prompt: string): string | null {
    const tools = this.parseTools(tool_list);
    if (tools.length === 0) return null;
    const inputWords = new Set(this.words(`${context}\n${prompt}`));
    let best: { name: string; score: number } | null = null;
    for (const candidate of tools) {
      const nameWords = this.words(candidate.name);
      if (nameWords.length === 0) continue;
      const score = nameWords.filter((word) => inputWords.has(word)).length;
      if (score === nameWords.length && (!best || score > best.score)) {
        best = { name: candidate.name, score };
      }
    }
    if (!best) return null;
    EventBus.emit('model-function-call', { name: best.name, args: {} });
    return `Function call: ${best.name}`;
  }

  private hostedAiUnavailableMessage(error?: unknown): string {
    const detail = error instanceof Error ? error.message : '';
    if (/auth|token|sign/i.test(detail)) {
      return 'Vifu AI needs a signed-in Vifu session for this game.';
    }
    return 'Vifu AI is unavailable right now. Please try again.';
  }

  private constructVifuTools(tool_list: string) {
    const functionObjs = this.parseTools(tool_list);
    if (functionObjs.length === 0) return undefined;

    const tools: Record<string, any> = {};
    for (const obj of functionObjs) {
      tools[obj.name] = {
        description: obj.description,
        parameters: obj.parameters,
        execute: (args: Record<string, unknown>) => this.executeVifuTool(obj.name, args)
      };
    }
    return Object.keys(tools).length > 0 ? tools : undefined;
  }

  private executeVifuTool(name: string, args: Record<string, unknown>) {
    return new Promise((resolve) => {
      this.pendingToolResults.push((result) => resolve(result?.output ?? result));
      EventBus.emit('model-function-call', { name, args });
    });
  }

  private handleToolResult(result: any) {
    const pendingToolResult = this.pendingToolResults.shift();
    if (pendingToolResult) pendingToolResult(result);
  }

  async *generateTextStream(tool_list: string, context: string, prompt: string): AsyncGenerator<string> {
    await this.waitForVifuHost();
    const generateText = this.vifuAi()?.generateText;
    if (!generateText) {
      const deterministic = this.deterministicToolCall(tool_list, context, prompt);
      yield deterministic ?? this.hostedAiUnavailableMessage();
      return;
    }

    const userMessage = context ? `Context: ${context}\n${prompt ? 'User: ' + prompt : ''}` : prompt;
    this.history.push({ role: 'user', content: userMessage });

    try {
      const result = await generateText({
        model: 'basic',
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
      console.warn('Vifu AI failed.', error);
      const deterministic = this.deterministicToolCall(tool_list, context, prompt);
      yield deterministic ?? this.hostedAiUnavailableMessage(error);
    }
  }

  async *generateHtmlStream(prompt: string, previousHtml: string = ""): AsyncGenerator<string> {
    await this.waitForVifuHost();
    const chat = this.vifuAi()?.chat;
    if (!chat) {
      yield previousHtml || '<html><body><p>Vifu AI is unavailable right now.</p></body></html>';
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
      console.warn('Vifu AI HTML generation failed.', error);
    }

    yield previousHtml || '<html><body><p>Vifu AI is unavailable right now.</p></body></html>';
  }
}
