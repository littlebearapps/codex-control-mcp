import { z } from 'zod';
declare const LocalExecInputSchema: z.ZodObject<{
    task: z.ZodString;
    workingDir: z.ZodOptional<z.ZodString>;
    mode: z.ZodDefault<z.ZodOptional<z.ZodEnum<["read-only", "full-auto", "danger-full-access"]>>>;
    outputSchema: z.ZodOptional<z.ZodAny>;
    skipGitRepoCheck: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    model: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    task: string;
    mode: "read-only" | "full-auto" | "danger-full-access";
    skipGitRepoCheck: boolean;
    outputSchema?: any;
    model?: string | undefined;
    workingDir?: string | undefined;
}, {
    task: string;
    mode?: "read-only" | "full-auto" | "danger-full-access" | undefined;
    outputSchema?: any;
    model?: string | undefined;
    workingDir?: string | undefined;
    skipGitRepoCheck?: boolean | undefined;
}>;
export type LocalExecInput = z.infer<typeof LocalExecInputSchema>;
export interface LocalExecResult {
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
export declare class LocalExecTool {
    static getSchema(): {
        name: string;
        description: string;
        inputSchema: {
            type: string;
            properties: {
                task: {
                    type: string;
                    description: string;
                };
                workingDir: {
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
                skipGitRepoCheck: {
                    type: string;
                    description: string;
                    default: boolean;
                };
                model: {
                    type: string;
                    description: string;
                };
            };
            required: string[];
        };
    };
    execute(input: LocalExecInput): Promise<LocalExecResult>;
}
export {};
//# sourceMappingURL=local_exec.d.ts.map