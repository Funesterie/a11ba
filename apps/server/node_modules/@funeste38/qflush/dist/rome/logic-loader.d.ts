import { LogicRule } from './logic-parser.js';
import { RomeIndex, RomeTagRecord } from './rome-tag.js';
export declare function loadLogicRules(): LogicRule[];
export declare function evaluateRulesForRecord(index: RomeIndex, rec: RomeTagRecord, changedPaths?: string[]): {
    rule: string;
    actions: string[];
}[];
export declare function evaluateAllRules(index: RomeIndex, changedPaths?: string[]): {
    path: string;
    actions: string[];
    rule: string;
}[];
export declare function getRules(): LogicRule[];
