#!/usr/bin/env python3
"""Helper cPanel (Hostinger) — login session + API calls.
Dipakai untuk manage DNS zone & upload file ke public_html.

Konfigurasi lewat env (file `.env` di profil Hermes, default ~/.hermes/.env):
  CPANEL_URL   contoh: https://cpanel.domain.com   (port 2083 ditambah otomatis)
  CPANEL_USER  user cPanel
  CPANEL_PASS  password cPanel

Tidak ada host/user yang di-hardcode — biar repo aman dipublikasikan.
"""
import json, os, sys, re, requests

ENV_FILE = os.environ.get('HERMES_ENV_FILE') or os.path.expanduser('~/.hermes/.env')

def get_env(key):
    """Ambil value dari file env (default ~/.hermes/.env, override: env HERMES_ENV_FILE)."""
    if os.environ.get(key):
        return os.environ[key]
    try:
        with open(ENV_FILE) as f:
            for line in f:
                if line.startswith(key + '='):
                    return line.split('=', 1)[1].strip().strip('"')
    except FileNotFoundError:
        pass
    return None

def cpanel_url():
    """Base URL cPanel dari env CPANEL_URL (port default 2083)."""
    url = (get_env('CPANEL_URL') or '').rstrip('/')
    if not url:
        raise RuntimeError('CPANEL_URL belum diset (contoh: https://cpanel.domain.com)')
    if '://' not in url:
        url = 'https://' + url
    hostpart = url.split('://', 1)[1]
    if ':' not in hostpart:
        url += ':2083'
    return url

def login():
    user = get_env('CPANEL_USER')
    pwd = get_env('CPANEL_PASS')
    if not (user and pwd):
        raise RuntimeError('CPANEL_USER / CPANEL_PASS belum diset di ' + ENV_FILE)
    base_url = cpanel_url()
    s = requests.Session()
    s.get(base_url + '/login/', timeout=30)
    r1 = s.post(base_url + '/login/',
                data={'user': user, 'pass': pwd}, timeout=30, allow_redirects=False)
    m = re.search(r'/cpsess(\d+)/', r1.headers.get('Location', ''))
    if not m:
        raise RuntimeError('Login gagal, no cpsess. Status: %s' % r1.status_code)
    sess = m.group(1)
    base = base_url + '/cpsess' + sess
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
