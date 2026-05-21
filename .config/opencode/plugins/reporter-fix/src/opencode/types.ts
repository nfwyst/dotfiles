import type { Event, UserMessage, Part } from '@opencode-ai/sdk';

export type PluginEvent = Event;

export interface PluginEventInput {
  event: PluginEvent;
}

export interface ChatMessageInput {
  sessionID: string;
  agent?: string;
  model?: {
    providerID: string;
    modelID: string;
  };
  messageID?: string;
  variant?: string;
}

export interface ChatMessageOutput {
  message: UserMessage;
  parts: Part[];
}

export interface ChatParamsInput {
  sessionID: string;
  agent: string;
  model: {
    id: string;
    provider: {
      id: string;
    };
  };
  provider: {
    source: string;
    info: Record<string, unknown>;
    options: Record<string, unknown>;
  };
  message: UserMessage;
}

export interface ChatParamsOutput {
  temperature: number;
  topP: number;
  topK: number;
  maxOutputTokens: number | undefined;
  options: Record<string, unknown>;
}

export interface ToolExecuteBeforeInput {
  tool: string;
  sessionID: string;
  callID: string;
}

export interface ToolExecuteBeforeOutput {
  args: unknown;
}

export interface ToolExecuteAfterInput {
  tool: string;
  sessionID: string;
  callID: string;
  args: unknown;
}

export interface ToolExecuteAfterHookInput extends ToolExecuteAfterInput {}

export interface ToolExecuteAfterOutput {
  title: string;
  output: string;
  metadata: unknown;
}
