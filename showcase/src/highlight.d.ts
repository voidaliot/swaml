export type Token = { t: string; c?: 'keyword' | 'string' | 'comment' };
export function highlight(text: string, keywords: Set<string>): Token[][];
