export type ToolArguments = Record<string, unknown>;

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}
