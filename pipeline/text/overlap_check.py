"""Copyright overlap guard for lesson text: no run of N (default 8) consecutive identical words may be shared with a
reference corpus (textbooks, sources). Run it on every narration, subtitle, caption and quiz file before publishing.

    python overlap_check.py --corpus <files or dirs ...> --check <files or dirs ...> [--n 8]

Normalisation: lower case, ё -> е, stress marks and soft hyphens dropped, words hyphenated across PDF lines joined,
everything that is not a letter or digit is a separator. Corpus: .json (every string), .txt, .md, .pdf (PyMuPDF).
Checked: .json, .js, .mjs, .html, .md, .txt, .srt, .vtt (the whole text, code included: extra words only make the
check stricter). Prints the longest shared run per checked file; exit code 1 if any run reaches N.
The corpus itself is only read locally and never copied anywhere.
"""
import argparse
import json
import os
import re
import sys

ACUTE, SHY = chr(0x301), chr(0xad)
LETTERS = re.compile(r'[^0-9a-z' + chr(0x430) + '-' + chr(0x44f) + ']+')


def norm_words(t):
    t = re.sub('[-' + SHY + r']\s*\n\s*', '', t)          # join words hyphenated across PDF lines
    t = t.lower().replace(chr(0x451), chr(0x435)).replace(ACUTE, '').replace(SHY, '')
    return LETTERS.sub(' ', t).split()


def json_strings(o, out):
    if isinstance(o, str):
        out.append(o)
    elif isinstance(o, dict):
        for v in o.values():
            json_strings(v, out)
    elif isinstance(o, list):
        for v in o:
            json_strings(v, out)


def read_any(p):
    ext = os.path.splitext(p)[1].lower()
    if ext == '.pdf':
        import fitz  # PyMuPDF
        return [pg.get_text() for pg in fitz.open(p)]
    raw = open(p, encoding='utf-8', errors='ignore').read()
    if ext == '.json':
        try:
            out = []
            json_strings(json.loads(raw), out)
            return out
        except ValueError:
            return [raw]
    return [raw]


def iter_files(paths, exts):
    for p in paths:
        if os.path.isdir(p):
            for r, _, fs in os.walk(p):
                for f in sorted(fs):
                    if os.path.splitext(f)[1].lower() in exts:
                        yield os.path.join(r, f)
        elif os.path.exists(p):
            yield p


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--corpus', nargs='+', required=True)
    ap.add_argument('--check', nargs='+', required=True)
    ap.add_argument('--n', type=int, default=8)
    a = ap.parse_args()
    N = a.n
    grams = {k: set() for k in range(1, N + 1)}
    nwords = nfiles = 0
    for f in iter_files(a.corpus, {'.json', '.txt', '.md', '.pdf'}):
        nfiles += 1
        for chunk in read_any(f):
            w = norm_words(chunk)
            nwords += len(w)
            for k in range(3, N + 1):
                for i in range(len(w) - k + 1):
                    grams[k].add(' '.join(w[i:i + k]))
    print(f'corpus: {nfiles} files, {nwords} words')
    worst = 0
    hits = 0
    for f in iter_files(a.check, {'.json', '.js', '.mjs', '.html', '.md', '.txt', '.srt', '.vtt'}):
        longest, example = 0, ''
        for chunk in read_any(f):
            w = norm_words(chunk)
            for k in range(N, 2, -1):
                if k <= longest:
                    break
                for i in range(len(w) - k + 1):
                    g = ' '.join(w[i:i + k])
                    if g in grams[k]:
                        longest, example = k, g
                        break
        worst = max(worst, longest)
        if longest >= N:
            hits += 1
        print(f'{"FAIL" if longest >= N else "ok  "} longest shared run {longest:2d} words  {f}' + (f'  ("{example}")' if longest >= N else ''))
    print(f'checked: longest shared run anywhere {worst} words (limit {N - 1}); files over the limit: {hits}')
    sys.exit(1 if hits else 0)


if __name__ == '__main__':
    main()
