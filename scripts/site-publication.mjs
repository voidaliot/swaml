// The published edition that the site shows, and its exact files.
// The site reader shows the published book, never the working tree: book sources are read from the edition's tag when
// it is available and always verified against the sha256 digests of the edition's PDF manifest.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const key = edition => edition.split('.').map(Number);
const published = (root, edition) => ['pdf', 'manifest.json'].every(suffix => existsSync(new URL(`output/pdf/SWAML-${edition}-Specification.${suffix}`, root)));

/** The latest MAJOR.MINOR edition whose PDF and manifest are published under output/pdf. */
export function publishedEdition(root) {
    const editions = readdirSync(new URL('output/pdf/', root)).map(f => /^SWAML-(\d+\.\d+)-Specification\.pdf$/.exec(f)?.[1]).filter(e => e && published(root, e))
        .sort((x, y) => { const [a, b] = [key(x), key(y)]; return a[0] - b[0] || a[1] - b[1]; });
    if (!editions.length) throw Error('No published MAJOR.MINOR edition under output/pdf');
    return editions.at(-1);
}

export function readManifest(root, edition) {
    return JSON.parse(readFileSync(new URL(`output/pdf/SWAML-${edition}-Specification.manifest.json`, root), 'utf8'));
}

const git = (root, args, encoding) => execFileSync('git', args, { cwd: fileURLToPath(root), encoding, maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
/** Whether the edition tag (vX.Y) is present in the checkout. */
export function hasTag(root, edition) {
    try { git(root, ['rev-parse', '--verify', '--quiet', `refs/tags/v${edition}^{tree}`], 'utf8'); return true; } catch { return false; }
}

/** Every file and directory of the edition tag; without the tag, the manifest's files and their directories. */
export function editionTree(root, edition, manifest = readManifest(root, edition)) {
    if (hasTag(root, edition)) return { fromTag: true, paths: new Set(git(root, ['ls-tree', '-r', '-t', '--name-only', `v${edition}`], 'utf8').split('\n').filter(Boolean)) };
    const paths = new Set();
    for (const { path } of manifest.sources) { const parts = path.split('/'); for (let i = 1; i <= parts.length; i++) paths.add(parts.slice(0, i).join('/')); }
    return { fromTag: false, paths };
}

const canonical = (path, raw) => /\.(png|ttf)$/.test(path) ? raw : Buffer.from(raw.toString('latin1').replace(/\r\n/g, '\n'), 'latin1');

/** A reader of published files: from the tag when present, else the working tree; manifest sources must match their digest. */
export function publishedReader(root, edition, manifest = readManifest(root, edition)) {
    const digests = new Map(manifest.sources.map(s => [s.path, s.sha256]));
    const tag = hasTag(root, edition);
    return {
        fromTag: tag,
        bytes(path) {
            const raw = canonical(path, tag ? git(root, ['show', `v${edition}:${path}`]) : readFileSync(new URL(path, root)));
            const digest = digests.get(path);
            if (!digest) throw Error(`${path} is not a source of the published ${edition} book`);
            if (createHash('sha256').update(raw).digest('hex') !== digest)
                throw Error(`${path} differs from the published ${edition} book (manifest sha256). The published ${edition} text is frozen; the site shows the published edition.`);
            return raw;
        },
        text(path) { return this.bytes(path).toString('utf8'); },
    };
}
