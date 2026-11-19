import { SWAML_LANGUAGE_VERSION } from '../language/swaml-module.js';
/** This host selects one language edition; it never infers a version from source. */
export const LANGUAGE_VERSION = SWAML_LANGUAGE_VERSION;
/** Checks and removes --language-version, returning the remaining arguments in order. */
export function withoutLanguageVersion(args: string[]): string[] {
    const rest: string[] = [];
    let selected = false;
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--language-version' || arg.startsWith('--language-version=')) {
            if (selected)
                throw new Error('--language-version may be specified only once');
            selected = true;
            const version = arg === '--language-version' ? args[++i] : arg.slice('--language-version='.length);
            if (version !== LANGUAGE_VERSION)
                throw new Error(`Unsupported language version ${version ?? '(missing)'}; this host implements swa.ml ${LANGUAGE_VERSION}.${version === '2.3' ? ' The edition drafted as 2.3 is swa.ml 3.0: pass --language-version 3.0.' : ''}`);
        }
        else
            rest.push(arg);
    }
    return rest;
}
export function languageArguments(args: string[]): string[] {
    const files = withoutLanguageVersion(args);
    const option = files.find(arg => arg.startsWith('-'));
    if (option)
        throw new Error(`Unknown option ${option}`);
    return files;
}
