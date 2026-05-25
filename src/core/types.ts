export type AutonomyMode = 'assist' | 'smart' | 'yolo';

export type SafetyLevel = 'safe' | 'warning' | 'dangerous';

export interface PlanStep {
  id: number;
  description: string;
  action: string;
  tool?: string;
  args?: Record<string, string>;
}

export interface StepResult {
  stepId: number;
  description: string;
  success: boolean;
  output: string;
  error?: string;
}

export interface AgentContext {
  mode: AutonomyMode;
  workingDir: string;
  maxRetries: number;
  maxSteps: number;
}

export interface ApprovalVerdict {
  allowed: boolean;
  reason?: string;
}
