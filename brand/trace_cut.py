#!/usr/bin/env python3
"""Trace the die line for a sticker.

The die line is a TRACED outline of the fattened keyline, not a stroke on it.
A stroke rings every boundary it meets, including the enclosed counter of an
"a" or a "B", which puts a stray magenta loop inside the letter. Tracing the
filled keyline gives the outer boundary only.

Rasterise with headless Chrome. ImageMagick on this machine has no librsvg
delegate and silently falls back to its own MSVG renderer, which ignores a
stroke set on a <g> - so the keyline comes out unfattened and the trace is of
the bare letters. Anything that rasterises our SVGs must go through Chrome.
"""
import json, os, re, subprocess, sys, tempfile, importlib.util

HERE = os.path.dirname(os.path.abspath(__file__))
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

def load_build():
    spec = importlib.util.spec_from_file_location("bld", os.path.join(HERE, "build.py"))
    m = importlib.util.module_from_spec(spec); sys.modules["bld"] = m
    try: spec.loader.exec_module(m)
    except SystemExit: pass
    return m

def rasterise(svg, px_w, px_h, out_png):
    d = tempfile.mkdtemp()
    html = os.path.join(d, "p.html")
    open(html, "w").write(
        '<!doctype html><body style="margin:0;background:#fff">' + svg + '</body>')
    subprocess.run([CHROME, "--headless", "--disable-gpu", "--no-sandbox",
                    "--hide-scrollbars", "--force-device-scale-factor=1",
                    f"--screenshot={out_png}", f"--window-size={px_w},{px_h}",
                    "file://" + html], capture_output=True)
    return os.path.exists(out_png)

def trace(png, close_disk, out_json, W, H, pad):
    bmp = png + ".pbm"
    subprocess.run(["magick", png, "-alpha", "remove", "-colorspace", "gray",
                    "-threshold", "50%", "-negate",
                    "-morphology", "Close", f"Disk:{close_disk}",
                    "-negate", bmp], check=True)
    svg = subprocess.run(["potrace", "-s", "-o", "-", "--flat", "-a", "1.2",
                          "-t", "40", bmp], capture_output=True, check=True).stdout.decode()
    vb = [float(x) for x in re.search(r'viewBox="([-\d. ]+)"', svg).group(1).split()]
    g = re.search(r'<g([^>]*transform="translate\([^)]*\) scale\([^)]*\)"[^>]*)>(.*)</g>',
                  svg, re.S)
    attrs = re.search(r'transform="[^"]*"', g.group(1)).group(0)
    paths = g.group(2).strip()
    iscale = abs(float(re.search(r'scale\(([-\d.]+)', attrs).group(1)))
    json.dump({"attrs": attrs, "vb": vb, "iscale": iscale,
               "paths": paths, "W": W, "H": H, "pad": pad},
              open(out_json, "w"))
    return paths.count("<path"), vb

if __name__ == "__main__":
    b = load_build()
    PAD, PXW = 40.0, 2400
    # --- slogan -------------------------------------------------------------
    W, H, B = 320.0, 238.0, 14.0
    key, _, _ = b._slogan_lockup(b.INK, "#6b7a90", stroke="#000", sw=B * 2)
    vbw, vbh = W + 2*PAD, H + 2*PAD
    pxh = int(round(PXW * vbh / vbw))
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{-PAD} {-PAD} {vbw} {vbh}" '
           f'width="{PXW}" height="{pxh}">'
           f'<rect x="{-PAD}" y="{-PAD}" width="{vbw}" height="{vbh}" fill="#fff"/>'
           f'{key}</svg>')
    png = os.path.join(tempfile.gettempdir(), "slogan-key.png")
    assert rasterise(svg, PXW, pxh, png), "chrome screenshot failed"
    n, vb = trace(png, int(sys.argv[1]) if len(sys.argv) > 1 else 55,
                  os.path.join(HERE, "slogan-cut.json"), W, H, PAD)
    print(f"  slogan die line: {n} subpath(s), raster {PXW}x{pxh}, trace vb {vb[2]:.0f}x{vb[3]:.0f}")
