// FIX: Manually define the types for import.meta.env to resolve TypeScript errors
// related to Vite environment variables, as the vite/client types could not be found.
interface ImportMetaEnv {
    readonly VITE_API_BASE_URL: string;
    readonly VITE_SUPABASE_URL: string;
    readonly VITE_SUPABASE_ANON_KEY: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}

// Add module declarations for clsx and tailwind-merge to resolve TypeScript errors
// when using shadcn/ui utilities.
declare module 'clsx' {
    export type ClassValue = string | number | ClassDictionary | ClassArray | undefined | null | false;
    interface ClassDictionary {
        [id: string]: any;
    }
    interface ClassArray extends Array<ClassValue> {}
    export function clsx(...inputs: ClassValue[]): string;
    export default clsx;
}

declare module 'tailwind-merge' {
    export function twMerge(...classLists: any[]): string;
}
