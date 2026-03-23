import { CopilotConfig, TelemetryEvent, EngineState, RuleEvent, Diagnostic } from './copilot-types.js';
export declare function initCopilotBridge(): void;
export declare function emitEngineState(state: EngineState): Promise<void>;
export declare function emitRuleEvent(ev: RuleEvent): Promise<void>;
export declare function emitDiagnostic(diag: Diagnostic): Promise<void>;
export declare function onTelemetry(cb: (ev: TelemetryEvent) => void): void;
export declare function shutdownCopilotBridge(): void;
export declare function getConfig(): CopilotConfig;
