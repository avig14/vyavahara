"""Render HTML templates in templates/ to PNG (headless Edge/Chrome).

Usage:
  py -3.11 render.py                      # all templates with samples.json -> png/
  py -3.11 render.py wa-payment-received  # one template
  py -3.11 render.py wa-payment-received data.json out.png   # your own data (bot use)

A template is plain HTML with {{placeholders}}; its size is in <meta name="size" content="WxH">.
Missing placeholders render empty. `note` is a small "Sample data" tag: leave it empty for real messages.
The same approach works in any bot runtime (Puppeteer/Playwright/satori): fill placeholders, screenshot at WxH.
"""
import os, re, sys, json, subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
TPL = os.path.join(HERE, 'templates')
EDGE = next((p for p in (r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
                         r'C:\Program Files\Google\Chrome\Application\chrome.exe') if os.path.exists(p)), None)

def esc(v):
    return str(v).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')

def render(name, data, out):
    html = open(os.path.join(TPL, name + '.html'), encoding='utf-8').read()
    w, h = map(int, re.search(r'name="size" content="(\d+)x(\d+)"', html).groups())
    html = re.sub(r'\{\{(\w+)\}\}', lambda m: esc(data.get(m.group(1), '')), html)
    tmp = os.path.join(TPL, '_render_%s.html' % name)
    open(tmp, 'w', encoding='utf-8').write(html)
    try:
        subprocess.run([EDGE, '--headless', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files',
                        '--virtual-time-budget=3000', '--screenshot=' + out, '--window-size=%d,%d' % (w, h),
                        'file:///' + tmp.replace('\\', '/')], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    finally:
        os.remove(tmp)
    print('rendered', out, os.path.exists(out))

if __name__ == '__main__':
    samples = json.load(open(os.path.join(HERE, 'samples.json'), encoding='utf-8'))
    names = [sys.argv[1]] if len(sys.argv) > 1 else sorted(n[:-5] for n in os.listdir(TPL) if n.endswith('.html'))
    for n in names:
        data = json.load(open(sys.argv[2], encoding='utf-8')) if len(sys.argv) > 2 else samples.get(n, {})
        out = sys.argv[3] if len(sys.argv) > 3 else os.path.join(HERE, 'png', n + '.png')
        render(n, data, out)
