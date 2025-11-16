import { z } from 'zod';
declare const LocalExecInputSchema: z.ZodObject<{
    task: z.ZodString;
    workingDir: z.ZodOptional<z.ZodString>;
    mode: z.ZodDefault<z.ZodOptional<z.ZodEnum<["read-only", "workspace-write", "danger-full-access"]>>>;
    outputSchema: z.ZodOptional<z.ZodAny>;
    skipGitRepoCheck: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    model: z.ZodOptional<z.ZodString>;
    allow_destructive_git: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    task: string;
    mode: "read-only" | "workspace-write" | "danger-full-access";
    skipGitRepoCheck: boolean;
    allow_destructive_git: boolean;
    outputSchema?: any;
    model?: string | undefined;
    workingDir?: string | undefined;
}, {
    task: string;
    mode?: "read-only" | "workspace-write" | "danger-full-access" | undefined;
    outputSchema?: any;
    model?: string | undefined;
    workingDir?: string | undefined;
    skipGitRepoCheck?: boolean | undefined;
    allow_destructive_git?: boolean | undefined;
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
                allow_destructive_git: {
                    type: string;
                    description: string;
                    default: boolean;
                };
            };
            required: string[];
        };
    };
    execute(input: LocalExecInput): Promise<any>;
}
export {};
//# sourceMappingURL=local_exec.d.ts.map