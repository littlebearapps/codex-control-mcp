import { z } from 'zod';
import { ToolExecuteExtra } from '../types/progress.js';
declare const LocalResumeInputSchema: z.ZodObject<{
    threadId: z.ZodString;
    task: z.ZodString;
    mode: z.ZodDefault<z.ZodOptional<z.ZodEnum<["read-only", "workspace-write", "danger-full-access"]>>>;
    outputSchema: z.ZodOptional<z.ZodAny>;
    model: z.ZodOptional<z.ZodString>;
    allow_destructive_git: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    task: string;
    mode: "read-only" | "workspace-write" | "danger-full-access";
    threadId: string;
    allow_destructive_git: boolean;
    outputSchema?: any;
    model?: string | undefined;
}, {
    task: string;
    threadId: string;
    mode?: "read-only" | "workspace-write" | "danger-full-access" | undefined;
    outputSchema?: any;
    model?: string | undefined;
    allow_destructive_git?: boolean | undefined;
}>;
export type LocalResumeInput = z.infer<typeof LocalResumeInputSchema>;
export interface LocalResumeResult {
    success: boolean;
    threadId: string;
    events: any[];
    finalResponse: string;
    usage?: {
        input_tokens: number;
        cached_input_tokens: number;
        output_tokens: number;
    };
    error?: string;
}
export declare class LocalResumeTool {
    static getSchema(): {
        name: string;
        description: string;
        inputSchema: {
            type: string;
            properties: {
                threadId: {
                    type: string;
                    description: string;
                };
                task: {
                    type: string;
                    description: string;
                };
                mode: {
                    type: string;
                    enum: string[];
                    description: string;
                    default: string;
                };
                outputSchema: {
                    type: string;
                    description: string;
                };
                model: {
                    type: string;
                    description: string;
                };
            };
            required: string[];
        };
    };
    execute(input: LocalResumeInput, extra?: ToolExecuteExtra): Promise<any>;
}
export {};
//# sourceMappingURL=local_resume.d.ts.map