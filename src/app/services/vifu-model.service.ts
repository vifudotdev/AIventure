import { Injectable, OnDestroy } from '@angular/core';
import { EventBus } from '../../game/core/EventBus';
import { ModelBackend } from './model-backend.interface';

type VifuWindow = Window & {
  Vifu?: {
    ready?: () => Promise<unknown>;
    status?: () => VifuStatus;
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

type VifuStatus = { hostConnected?: boolean; transport?: string };

type VifuToolDefinition = {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
};

@Injectable({
  providedIn: 'root'
})
export class VifuModelService implements ModelBackend, OnDestroy {
  private history: any[] = [];
  private pendingToolResults: Array<{ resolve: (result: any) => void; timeout: ReturnType<typeof setTimeout> }> = [];
  private hostReadyAttempt?: Promise<void>;

  constructor() {
    EventBus.on('model-tool-execution-result', this.handleToolResult, this);
  }

  ngOnDestroy() {
    EventBus.off('model-tool-execution-result', this.handleToolResult, this);
    this.clearPendingToolResults();
  }

  public reset() {
    this.history = [];
    this.clearPendingToolResults();
  }

  private clearPendingToolResults() {
    for (const pending of this.pendingToolResults) {
      clearTimeout(pending.timeout);
      pending.resolve({ ok: false, error: 'Game tool call cancelled.' });
    }
    this.pendingToolResults = [];
  }

  private vifuAi() {
    return (window as VifuWindow).Vifu?.ai ?? null;
  }

  private vifuStatus(): VifuStatus {
    return (window as VifuWindow).Vifu?.status?.() ?? { transport: 'none', hostConnected: false };
  }

  private isHostedVifuRuntime(status: VifuStatus): boolean {
    return Boolean(status.hostConnected || (status.transport && status.transport !== 'none'));
  }

  private async waitForVifuHost(): Promise<VifuStatus> {
    const vifu = (window as VifuWindow).Vifu;
    const initialStatus = this.vifuStatus();
    if (!vifu?.ready || initialStatus.hostConnected || initialStatus.transport === 'none') return initialStatus;
    this.hostReadyAttempt ??= Promise.race([
      vifu.ready().then(() => undefined),
      new Promise<void>((resolve) => setTimeout(resolve, 5000)),
    ]).catch(() => undefined);
    await this.hostReadyAttempt;
    return this.vifuStatus();
  }

  private parseTools(tool_list: string): VifuToolDefinition[] {
    if (!tool_list) return [];
    try {
      const parsed = JSON.parse(tool_list);
      if (!Array.isArray(parsed)) return [];
      return parsed.flatMap((entry): VifuToolDefinition[] => {
        const source = entry?.type === 'function' && entry?.function ? entry.function : entry;
        const name = typeof source?.name === 'string' ? source.name.trim() : '';
        if (!name) return [];
        return [{
          name,
          description: typeof source.description === 'string' ? source.description : undefined,
          parameters: source.parameters && typeof source.parameters === 'object'
            ? source.parameters
            : undefined
        }];
      });
    } catch {
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

  private shouldUseDeterministicFallback(status: VifuStatus, error?: unknown): boolean {
    if (!this.isHostedVifuRuntime(status)) return true;
    if (!status.hostConnected) return true;
    const detail = error instanceof Error ? error.message : '';
    return /auth|token|sign|unavailable|not available|timed out|host transport/i.test(detail);
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

  private messagesForTurn(tool_list: string) {
    const tools = this.parseTools(tool_list);
    if (tools.length === 0) return this.history;
    return [
      {
        role: 'system',
        content: 'Use the provided game action tools when the player request matches an available action. Do not say you cannot interact with the game when an appropriate tool exists. After a tool runs, briefly report the tool result.'
      },
      ...this.history
    ];
  }

  private executeVifuTool(name: string, args: Record<string, unknown>) {
    return new Promise((resolve) => {
      let pendingEntry: { resolve: (result: any) => void; timeout: ReturnType<typeof setTimeout> } | null = null;
      const timeout = setTimeout(() => {
        if (!pendingEntry) return;
        const index = this.pendingToolResults.findIndex((entry) => entry === pendingEntry);
        if (index >= 0) this.pendingToolResults.splice(index, 1);
        resolve({ ok: false, error: `Game tool ${name} did not return a result.` });
      }, 5000);
      pendingEntry = {
        resolve: (result) => {
          clearTimeout(timeout);
          resolve(result?.output ?? result ?? { ok: true });
        },
        timeout
      };
      this.pendingToolResults.push(pendingEntry);
      EventBus.emit('model-function-call', { name, args });
    });
  }

  private handleToolResult(result: any) {
    const pendingToolResult = this.pendingToolResults.shift();
    if (pendingToolResult) pendingToolResult.resolve(result);
  }

  private toolCallName(toolCall: any): string | undefined {
    return typeof toolCall?.name === 'string'
      ? toolCall.name
      : typeof toolCall?.toolName === 'string'
        ? toolCall.toolName
        : undefined;
  }

  private readableToolResult(value: any): string | null {
    if (!value) return null;
    if (typeof value === 'string') return value;
    const candidates = [
      value.output,
      value.result,
      value.content,
      value.structuredContent,
      value.result?.output,
      value.result?.result,
      value.result?.content
    ];
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
    }
    return null;
  }

  private firstToolResultText(result: any): string | null {
    const toolResults = Array.isArray(result?.toolResults) ? result.toolResults : [];
    for (const toolResult of toolResults) {
      const text = this.readableToolResult(toolResult);
      if (text) return text;
    }
    const steps = Array.isArray(result?.steps) ? result.steps : [];
    for (const step of steps) {
      const stepToolResults = Array.isArray(step?.toolResults) ? step.toolResults : [];
      for (const toolResult of stepToolResults) {
        const text = this.readableToolResult(toolResult);
        if (text) return text;
      }
    }
    return toolResults.length > 0 ? 'Action completed.' : null;
  }

  async *generateTextStream(tool_list: string, context: string, prompt: string): AsyncGenerator<string> {
    const status = await this.waitForVifuHost();
    const generateText = this.vifuAi()?.generateText;
    if (!generateText) {
      const deterministic = this.shouldUseDeterministicFallback(status)
        ? this.deterministicToolCall(tool_list, context, prompt)
        : null;
      yield deterministic ?? this.hostedAiUnavailableMessage();
      return;
    }

    const userMessage = context ? `Context: ${context}\n${prompt ? 'User: ' + prompt : ''}` : prompt;
    this.history.push({ role: 'user', content: userMessage });

    try {
      const result = await generateText({
        model: 'basic',
        messages: this.messagesForTurn(tool_list),
        tools: this.constructVifuTools(tool_list),
        maxSteps: 3
      });
      const content = result.content || result.text || '';
      if (content) {
        this.history.push({ role: 'assistant', content });
        yield content;
      }
      if (!content) {
        const toolResultText = this.firstToolResultText(result);
        if (toolResultText) yield toolResultText;
      }
      if (Array.isArray(result.toolCalls)) {
        for (const toolCall of result.toolCalls) {
          const name = this.toolCallName(toolCall);
          if (name) yield `Function call: ${name}`;
        }
      }
    } catch (error) {
      const deterministic = this.shouldUseDeterministicFallback(status, error)
        ? this.deterministicToolCall(tool_list, context, prompt)
        : null;
      yield deterministic ?? this.hostedAiUnavailableMessage(error);
    }
  }

  async *generateHtmlStream(prompt: string, previousHtml: string = ""): AsyncGenerator<string> {
    const status = await this.waitForVifuHost();
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
    } catch {
    }

    yield previousHtml || '<html><body><p>Vifu AI is unavailable right now.</p></body></html>';
  }
}
