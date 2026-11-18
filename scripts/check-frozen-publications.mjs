// Published editions are frozen. The archive PDF checks only compare a PDF with its
// own manifest and .sha256 file, which are workspace files too, so a rebuild passes
// them. This check pins the published bytes here and requires each edition-specific
// workspace copy that a published manifest lists to equal its recorded hash.
//
// Hashing: PDF, PNG and TTF files are compared byte for byte. Every other file
// (.manifest.json, .sha256, Markdown, SVG, JSON scenes and traces) is compared after
// CRLF is normalized to LF, the canonical form the publication builders hashed and
// the form .gitattributes checks out on every platform.
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** SHA-256 of output/pdf/SWAML-<edition>-Specification.{pdf,manifest.json,sha256}. */
export const publishedEditions = new Map([
    ['0.1.0', {pdf: 'df8dff483eb4b31a93a7ccf140698ff47b53086faf0493dccea978fe2549d9bc', 'manifest.json': '5339a88cde129dec1b34ff70997ec261c66a0201d3408b070ef76d2e3aa3249a', sha256: '8e3deee48e361c0692ff093c03ce334333c207cacc079a479a20a5ffd7a56332'}],
    ['1.0.0', {pdf: 'af0fb5a0adab2ed3a89dfcf4d0ea265bfdbc22e2515daf5e440a098148adbd09', 'manifest.json': '84c28eb85371b3ef654daffbd8da27f3d7841419f18c9f089ae22f97e61a6b31', sha256: '63f9c4ea9ef94c646948170dead977bdb7836c28088e1bb2b73571da19530beb'}],
    ['1.1.0', {pdf: '9c7b73a96d38cf22913287b18ecde38406f123547655945ed20f3431d057197f', 'manifest.json': '9db91513a7774e47cfa2125de6a99a8c225b3f0ef5cb08ffec27e4f14995d999', sha256: 'ad6885fe5abeb47466c72dd84070289ce492e82b675b4ee2fb746be5b476a3ae'}],
    ['1.1.1', {pdf: '126cdd3de1e167f36d9268066442fc1b025bac518952dddc2a88c507daa4527b', 'manifest.json': 'a029de2756cf9453b94a3564d85a2e0ee70beafbb6c24f90c1d0c94e45eb074c', sha256: '03681c4ca7000a33a193e9423a021ce8e67d3b6e283228e6b22dec16d4a1be75'}],
    ['1.2.0', {pdf: '2dbdcccdc1921ddbc8336baf92c3d7d9369d583ae3a30f3fec7c34e2d21f7403', 'manifest.json': 'fea053bf48ace2a52afe082086df4ca37f4ac1d5c4dc0c68cc924011354b1bab', sha256: '332731ad6f4ca2ec6495ae16e529fac0ce9b329921ad22ed76954109eefee490'}],
    ['1.2.1', {pdf: '47f4acbb092d34b4643fea7c9c161c49d11fe4003b7892c0352467b749df63b5', 'manifest.json': '43f049d5c9653f52d7033d316fc6814b385a07f65d789a641e2bd4e5b8947425', sha256: '654d2ff5171909953b37215c75df07f96371a2d6e1337e4ae259642d91100fff'}],
    ['1.3.0', {pdf: '619bf459600fbabc34fb22087d28dd4eabef5582a792a6555049ca0a430b75dd', 'manifest.json': 'd3b735470a56878d154d91e237e8c114c96e5f159fb5986ef4d17c260b0fb5e6', sha256: 'c00d7498d78a656c8034101083dfd813e3bf45dbd5ce112c0bdc9116f383f244'}],
    ['1.3.1', {pdf: 'f56bcfda53d31dcf20548a96f8dd101d83f37a1827a3517981c77e6d2dfeceaa', 'manifest.json': '627a6b140c83939a8fbc2bf24007490e8cb5bec16be525a924054f7413593e04', sha256: 'c2a6daee200dc0f3b5ee504a59e29a252fa1fb18287a586dacdb0b72a6bed947'}],
    ['2.0.0', {pdf: '44b30b67ca3b29fdd2541ae926d66fe408697bf8a44e0852c6154d75032fd79c', 'manifest.json': 'c6b5e99294146af3ca2926aa50d9ce3462790aaa6a080b6f1068a9064202d683', sha256: '9c0c7446f01aaf0fced63fddba4e3020bcbb677e6a28362e4a81b4003247c32f'}],
    ['2.1', {pdf: 'd2bce7f2a0362232b4d1c032a9b68bc70466906f2f8922075486b06fca66d271', 'manifest.json': '0cb3f826c20117d7bd830dcab97928946c93c77ca5e0fede788f88990758e7c6', sha256: '876532fb943ed2171d96dee6f783e7a2f4a09c85a2f544f016b69a0bc34cd910'}],
    ['2.2', {pdf: '481ee9a6a08d155f332180aa89a97b4854bf82abd73c12dd4a817b03b04ec868', 'manifest.json': 'a52a67639784965090517151312c7a3fc57c1e77fb74d81a4fc04a9cb483fffa', sha256: 'c24d3f6b61021eff4766e821e11fface5c8cff9d7b1e1cb8eec0966fce5ba911'}],
]);

/**
 * The release tag whose files the pins equal. By default the edition's own tag v<edition>;
 * the 0.1.0 to 1.1.1 publications were rebuilt by the 1.2.0 release (e175de6), so
 * their published files are those at v1.2.0.
 */
export const pinnedAtTag = new Map(['0.1.0', '1.0.0', '1.1.0', '1.1.1'].map(edition => [edition, 'v1.2.0']));

/**
 * Edition-specific workspace copies, compared with the hash their edition's
 * manifest records. `files` maps a workspace path to its manifest path; every file
 * in `directories` must be a manifest source and equal it.
 *
 * Every companion a manifest lists (reference book, release and migration notes)
 * and every script it lists is either frozen here or a named exception with its
 * reason. The publication scripts are frozen so that the archive checkers and the
 * tooling a published PDF embeds cannot be weakened unseen; a later edition adds
 * new X.Y files or removes an entry here in a reviewed change. Maintained sources
 * (docs/spec, the guides, src, examples, inventories) are not frozen: later
 * editions edit them, and only the published PDF keeps their released bytes.
 */
const same = (...paths) => Object.fromEntries(paths.map(path => [path, path]));
const later = commit => `changed by ${commit} after the release; the published PDF keeps the released bytes`;
const maintainedTooling = ['scripts/v2_scene.py', 'scripts/build-notation.py', 'scripts/build-graphical-examples.py', 'scripts/build-reference.mjs'];
export const frozenCopies = new Map([
    ['0.1.0', {files: {}, directories: [], count: 0, exceptions: {}}],
    ['1.0.0', {files: same('docs/MIGRATION_1_0.md', 'docs/RELEASE_1_0.md'), directories: [], count: 2,
        exceptions: {'docs/SWAML-1.0.0-Reference.md': later('the 1.2.0 release (e175de6)')}}],
    ['1.1.0', {files: same('docs/MIGRATION_1_1.md', 'docs/RELEASE_1_1.md'), directories: [], count: 2,
        exceptions: {'docs/SWAML-1.1.0-Reference.md': later('the 1.2.0 release (e175de6)')}}],
    ['1.1.1', {files: same('docs/MIGRATION_1_1.md', 'docs/RELEASE_1_1_1.md'), directories: [], count: 2,
        exceptions: {'docs/SWAML-1.1.1-Reference.md': later('the 1.2.0 release (e175de6)')}}],
    ['1.2.0', {files: same('docs/MIGRATION_1_1.md', 'docs/RELEASE_1_2_0.md', 'docs/SWAML-1.2.0-Reference.md'), directories: [], count: 3,
        exceptions: {'docs/MIGRATION_1_2.md': later('the 1.2.1 and 1.3.0 releases (c38d1cf, dc83eff)')}}],
    ['1.2.1', {files: same('docs/MIGRATION_1_1.md', 'docs/SWAML-1.2.1-Reference.md'), directories: [], count: 2,
        exceptions: {'docs/MIGRATION_1_2.md': later('the 1.3.0 release (dc83eff)'), 'docs/RELEASE_1_2_1.md': later('the 1.3.0 release (dc83eff)')}}],
    ['1.3.0', {files: same('docs/MIGRATION_1_1.md', 'docs/MIGRATION_1_2.md', 'docs/RELEASE_1_3_0.md', 'docs/SWAML-1.3.0-Reference.md'), directories: [], count: 4,
        exceptions: {'docs/MIGRATION_1_3.md': later('the 1.3.1 release (9dafa65)')}}],
    ['1.3.1', {files: same('docs/MIGRATION_1_1.md', 'docs/MIGRATION_1_2.md', 'docs/MIGRATION_1_3.md', 'docs/MIGRATION_1_3_1.md',
        'docs/RELEASE_1_3_0.md', 'docs/RELEASE_1_3_1.md', 'docs/SWAML-1.3.1-Reference.md'), directories: [], count: 7, exceptions: {}}],
    ['2.0.0', {files: {'history/2.0.0/docs/SWAML-2.0.0-Reference.md': 'docs/SWAML-2.0.0-Reference.md', ...same('scripts/pdf-requirements.txt')},
        directories: [], count: 2,
        // The workspace docs/SWAML-2.0.0-Reference.md is now a pointer (7cd52e3); the published book is the history copy frozen above.
        exceptions: {'docs/RELEASE_2_0_0.md': later('the swa.ml display-name change (4297f8c)'),
            'scripts/build-spec-pdf-2.0.py': later('the archive-mode change (7cd52e3)'), 'scripts/check-spec-pdf-2.0.py': later('the archive-mode change (7cd52e3)'),
            ...Object.fromEntries(maintainedTooling.map(path => [path, later('the 2.1 and 2.2 editions')]))}}],
    ['2.1', {files: {...same('docs/SWAML-2.1-Reference.md', 'docs/RELEASE_2_1.md', 'examples/simulation/hello-trace.json',
            'scripts/build-spec-pdf-2.1.py', 'scripts/check-spec-pdf-2.1.py', 'scripts/publication_2_1_sources.py', 'scripts/publication_archive.py',
            'scripts/ci-pdf-requirements.txt', 'scripts/standard-version.mjs')},
        directories: ['docs/figures/2.0/', 'docs/notation/2.0/'], count: 108,
        exceptions: Object.fromEntries(maintainedTooling.map(path => [path, later('the 2.2 edition (58cc8c6 and earlier)')]))}],
    ['2.2', {files: same('docs/SWAML-2.2-Reference.md', 'docs/RELEASE_2_2.md', 'scripts/build-spec-pdf-2.2.py', 'scripts/check-spec-pdf-2.2.py',
            'scripts/publication_2_2_sources.py', 'scripts/publication_archive.py', 'scripts/test-publication-2-2.py', 'scripts/ci-pdf-requirements.txt',
            'scripts/standard-version.mjs', ...maintainedTooling),
        directories: ['docs/figures/2.2/', 'docs/notation/2.2/', 'examples/simulation/2.2/'], count: 113, exceptions: {}}],
]);

/** Manifest sources that must be frozen or a named exception. */
const companion = /^(?:docs\/(?:SWAML-[^/]+-Reference|RELEASE_[^/]+|MIGRATION_[^/]+)\.md|scripts\/.+)$/u;

const binary = /\.(?:pdf|png|ttf)$/u;

/** SHA-256 of the canonical bytes of one file (see the header). */
export function canonicalDigest(path, raw) {
    const bytes = binary.test(path) ? raw : Buffer.from(raw.toString('latin1').replaceAll('\r\n', '\n'), 'latin1');
    return createHash('sha256').update(bytes).digest('hex');
}

async function digest(root, path) {
    const raw = await readFile(join(root, ...path.split('/'))).catch(() => { throw Error(`Missing frozen publication file: ${path}`); });
    return canonicalDigest(path, raw);
}

async function filesUnder(root, directory) {
    const entries = await readdir(join(root, ...directory.split('/')), {recursive: true, withFileTypes: true}).catch(() => []);
    return entries.filter(e => e.isFile())
        .map(e => (resolve(e.parentPath, e.name).slice(resolve(root).length + 1)).replaceAll('\\', '/')).sort();
}

/** Throws on the first difference; returns the number of pinned and compared files. */
export async function checkFrozenPublications(root, {editions = [...publishedEditions.keys()], copies: frozenEntries = frozenCopies} = {}) {
    let pinned = 0, copies = 0, exceptions = 0;
    for (const edition of editions) {
        const pins = publishedEditions.get(edition);
        if (!pins) throw Error(`No pinned publication for edition ${edition}`);
        const base = `output/pdf/SWAML-${edition}-Specification`;
        for (const [suffix, expected] of Object.entries(pins)) {
            if (await digest(root, `${base}.${suffix}`) !== expected)
                throw Error(`Published ${edition} file changed: ${base}.${suffix}. A published edition is never rebuilt or edited.`);
            pinned++;
        }
        const manifest = JSON.parse(await readFile(join(root, ...`${base}.manifest.json`.split('/')), 'utf8'));
        if (manifest.pdfSha256 !== pins.pdf) throw Error(`Published ${edition} manifest records another PDF`);
        const frozen = frozenEntries.get(edition);
        if (!frozen) throw Error(`No frozen-copy entry for edition ${edition}`);
        const recorded = new Map(manifest.sources.map(s => [s.path, s.sha256]));
        const expected = new Map(Object.entries(frozen.files));
        for (const directory of frozen.directories) {
            for (const path of recorded.keys()) if (path.startsWith(directory)) expected.set(path, path);
            for (const path of await filesUnder(root, directory)) {
                if (!recorded.has(path)) throw Error(`File added to a frozen ${edition} directory: ${path}`);
            }
        }
        if (expected.size !== frozen.count)
            throw Error(`Frozen ${edition} copies: expected ${frozen.count}, the manifest lists ${expected.size}`);
        for (const [path, source] of expected) {
            if (!recorded.has(source)) throw Error(`Frozen ${edition} copy is not a manifest source: ${source}`);
            if (await digest(root, path) !== recorded.get(source))
                throw Error(`Frozen ${edition} copy differs from its publication: ${path}`);
            copies++;
        }
        const covered = new Set(expected.values());
        for (const source of Object.keys(frozen.exceptions)) {
            if (!recorded.has(source) || covered.has(source)) throw Error(`Invalid ${edition} frozen-copy exception: ${source}`);
            exceptions++;
        }
        for (const source of recorded.keys()) {
            if (companion.test(source) && !covered.has(source) && !(source in frozen.exceptions))
                throw Error(`Published ${edition} companion or script is neither frozen nor a named exception: ${source}`);
        }
    }
    return {pinned, copies, exceptions};
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const root = fileURLToPath(new URL('..', import.meta.url));
    const {pinned, copies, exceptions} = await checkFrozenPublications(root);
    console.log(`Frozen publications: ${pinned} published files pinned for ${publishedEditions.size} editions; ${copies} frozen copies equal their manifests; ${exceptions} named exceptions.`);
}
