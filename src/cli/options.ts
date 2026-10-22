import { SWAML_LANGUAGE_VERSION } from '../language/swaml-module.js';
/** This host selects one language edition; it never infers a version from source. */
export const LANGUAGE_VERSION = SWAML_LANGUAGE_VERSION;
export function languageArguments(args: string[]): string[] {
    const files: string[] = [];
    let selected = false;
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--language-version' || arg.startsWith('--language-version=')) {
            if (selected)
                throw new Error('--language-version may be specified only once');
            selected = true;
            const version = arg === '--language-version' ? args[++i] : arg.slice('--language-version='.length);
            if (version !== LANGUAGE_VERSION)
                throw new Error(`Unsupported language version ${version ?? '(missing)'}; this host implements swa.ml ${LANGUAGE_VERSION}.`);
        }
        else if (arg.startsWith('-')) {
            throw new Error(`Unknown option ${arg}`);
        }
        else
            files.push(arg);
    }
    return files;
}
