#!/usr/bin/env python3
"""Render every sticker SVG to a print PDF and a 300 dpi PNG.

Rasterising and PDF-writing both go through headless Chrome. ImageMagick on
this machine has no librsvg delegate and falls back to its own MSVG renderer,
which silently ignores a stroke set on a <g> - so the white keyline and the
bleed vanish and the artwork comes out wrong without any error. Chrome is the
only renderer here that draws these files correctly.

Run `python3 build.py` first; it writes the SVGs and the manifest this reads.
"""
import json, os, subprocess, sys, tempfile, shutil

HERE = os.path.dirname(os.path.abspath(__file__))
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
DPI = 300

def page(svg_path, win, hin):
    """Wrap an SVG in a page sized to the sticker's exact physical size."""
    svg = open(svg_path).read()
    return (f'<!doctype html><style>@page{{size:{win:.4f}in {hin:.4f}in;margin:0}}'
            f'html,body{{margin:0;padding:0}}'
            f'svg{{display:block;width:{win:.4f}in;height:{hin:.4f}in}}</style>'
            f'<body>{svg}</body>')

def chrome(args, html):
    d = tempfile.mkdtemp()
    p = os.path.join(d, "p.html")
    open(p, "w").write(html)
    r = subprocess.run([CHROME, "--headless", "--disable-gpu", "--no-sandbox",
                        "--hide-scrollbars", "--force-device-scale-factor=1",
                        *args, "file://" + p], capture_output=True)
    shutil.rmtree(d, ignore_errors=True)
    return r

def main():
    man = json.load(open("/tmp/stickers.json"))
    npdf = npng = 0
    for kind, size, inches, cutline, svg, win, hin in man:
        pdf = svg[:-4] + ".pdf"
        chrome([f"--print-to-pdf={pdf}", "--no-pdf-header-footer"], page(svg, win, hin))
        if not os.path.exists(pdf):
            sys.exit(f"chrome failed to write {pdf}")
        npdf += 1
        # A 300 dpi PNG is the proof copy; the cutline version is for the
        # printer's blade, so it does not need one.
        if not cutline:
            png = svg[:-4] + f"-{DPI}dpi.png"
            w, h = int(round(win * DPI)), int(round(hin * DPI))
            chrome([f"--screenshot={png}", f"--window-size={w},{h}",
                    "--default-background-color=00000000"],
                   page(svg, win, hin).replace("<body>", '<body style="background:transparent">'))
            if not os.path.exists(png):
                sys.exit(f"chrome failed to write {png}")
            npng += 1
    print(f"  rendered {npdf} pdf and {npng} png at {DPI} dpi")

if __name__ == "__main__":
    main()
