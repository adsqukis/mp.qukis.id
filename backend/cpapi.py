#!/usr/bin/env python3
"""LEGACY — helper cPanel qukis.id (login session + API calls).

Hanya dipakai untuk deploy lama: upload dist/ ke Hostinger public_html dan
manage DNS zone qukis.id. Deploy ke mpqukis.web.id (VPS 43.156.70.224) TIDAK
memakai file ini — nginx serve dist/ langsung, lihat DEPLOY.md.

Kredensial dibaca dari CPANEL_ENV_FILE (default ~/.hermes/.env), dengan
CPANEL_HOST untuk host cPanel-nya.
"""
import json, os, sys, re, requests

CPANEL_ENV_FILE = os.environ.get(
    'CPANEL_ENV_FILE', os.path.expanduser('~/.hermes/.env'))
CPANEL_HOST = os.environ.get('CPANEL_HOST', 'cpanel.generosindo.com:2083')

def get_env(key):
    if os.environ.get(key):
        return os.environ[key]
    with open(CPANEL_ENV_FILE) as f:
        for line in f:
            if line.startswith(key + '='):
                return line.split('=', 1)[1].strip().strip('"')
    return None

def login():
    user = get_env('CPANEL_USER')
    pwd = get_env('CPANEL_PASS')
    s = requests.Session()
    login_url = f'https://{CPANEL_HOST}/login/'
    s.get(login_url, timeout=30)
    r1 = s.post(login_url,
                data={'user': user, 'pass': pwd}, timeout=30, allow_redirects=False)
    m = re.search(r'/cpsess(\d+)/', r1.headers.get('Location', ''))
    if not m:
        raise RuntimeError('Login gagal, no cpsess. Status: %s' % r1.status_code)
    sess = m.group(1)
    base = f'https://{CPANEL_HOST}/cpsess' + sess
    return s, base, user

def zoneedit(s, base, user, func, **params):
    p = {'cpanel_jsonapi_user': user, 'cpanel_jsonapi_apiversion': '2',
         'cpanel_jsonapi_module': 'ZoneEdit', 'cpanel_jsonapi_func': func}
    p.update(params)
    r = s.get(base + '/json-api/cpanel', params=p, timeout=30)
    d = r.json()
    return d

def fetchzone(s, base, user, domain='qukis.id'):
    d = zoneedit(s, base, user, 'fetchzone', domain=domain)
    return d['cpanelresult']['data'][0]['record']

if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'fetchzone'
    s, base, user = login()
    if cmd == 'fetchzone':
        for rec in fetchzone(s, base, user):
            if rec.get('type') == 'A':
                print(f"{rec.get('name')} -> {rec.get('address')} | line {rec.get('line')}")
        for rec in fetchzone(s, base, user):
            if rec.get('type') == 'SOA':
                print('SOA serial:', rec.get('serial') or rec.get('record'))
    else:
        print('unknown cmd')
