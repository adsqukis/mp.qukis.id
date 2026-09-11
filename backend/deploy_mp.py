#!/usr/bin/env python3
"""Deploy shopee-seller-hub dist ke Hostinger (mp.qukis.id) via cPanel Fileman API."""
import json, os, sys, requests

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cpapi

DIST = '/home/ubuntu/shopee-seller-hub/dist'
TARGET_DIR = '/home/u1734629/public_html/mp.qukis.id'

def save_file(s, base, path_rel, content, is_text=True):
    """path_rel relatif terhadap TARGET_DIR, contoh: 'index.html' atau 'assets/index-xxx.js'"""
    dir_part = TARGET_DIR + '/' + os.path.dirname(path_rel) if os.path.dirname(path_rel) else TARGET_DIR
    fname = os.path.basename(path_rel)
    r = s.post(base + '/execute/Fileman/save_file_content',
               data={'dir': dir_part, 'file': fname, 'content': content}, timeout=180)
    try:
        d = r.json()
    except Exception:
        return {'raw_status': r.status_code, 'text': r.text[:300]}
    return d

def main():
    s, base, user = cpapi.login()
    print('login ok')

    # index.html
    idx = open(os.path.join(DIST, 'index.html'), encoding='utf-8').read()
    d = save_file(s, base, 'index.html', idx)
    print('index.html ->', d.get('status'), d.get('errors'))

    # semua file di assets/
    assets_dir = os.path.join(DIST, 'assets')
    for f in sorted(os.listdir(assets_dir)):
        fp = os.path.join(assets_dir, f)
        if os.path.isfile(fp):
            content = open(fp, encoding='utf-8', errors='replace').read()
            d = save_file(s, base, 'assets/' + f, content)
            print(f'assets/{f} ->', d.get('status'), d.get('errors'))

    # verifikasi: list files
    r = s.get(base + '/execute/Fileman/list_files',
              params={'dir': TARGET_DIR + '/assets', 'show_hidden': 1}, timeout=30)
    dd = r.json()
    data = dd.get('data') or {}
    files = data.get('files') if isinstance(data, dict) else data
    print('assets di server:', [f.get('file') for f in files] if files else dd)

if __name__ == '__main__':
    main()
