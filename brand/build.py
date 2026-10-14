#!/usr/bin/env python3
"""Rebuild every ShaT Coin asset from one source of truth.

The Tether diamond is traced from the original artwork rather than hand drawn:
an earlier hand-drawn version got the cylinder band under the T wrong, which is
visible at sticker size. Everything else - icon, wordmark, stickers - is
composed from that traced mark plus the Bitcoin B, so they can never drift
apart again.
"""
import re, os, json, subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
BG = ("M43.1 28.6c.6-4.0-2.4-6.1-6.6-7.5l1.4-5.5-3.4-.8-1.3 5.3c-.9-.2-1.8-.4-2.7-.6"
 "l1.3-5.4-3.3-.8-1.4 5.5c-.7-.2-1.5-.3-2.2-.5v0l-4.6-1.2-.9 3.6s2.5.6 2.4.6"
 "c1.4.3 1.6 1.2 1.6 1.9l-1.6 6.3c.1 0 .2.1.3.1l-.3-.1-2.2 8.8c-.2.4-.6 1-1.6.8"
 ".1.1-2.4-.6-2.4-.6l-1.7 3.9 4.3 1.1c.8.2 1.6.4 2.4.6l-1.4 5.6 3.3.8 1.4-5.5"
 "c.9.2 1.8.5 2.7.7l-1.4 5.5 3.4.8 1.4-5.6c5.7 1.1 10 .6 11.8-4.5 1.4-4.1-.1-6.5-3.1-8.1"
 " 2.2-.5 3.8-1.9 4.2-4.9zm-7.6 10.7c-1 4.1-8.0 1.9-10.3 1.3l1.8-7.4c2.3.6 9.6 1.7 8.5 6.1z"
 "m1-10.8c-.9 3.8-6.7 1.8-8.6 1.4l1.7-6.7c1.9.5 7.9 1.4 6.9 5.3z")

src = open(os.path.join(HERE, "tether-traced.svg")).read()
_vb = [float(x) for x in re.search(r'viewBox="([^"]+)"', src).group(1).split()]
_gs = re.findall(r"<g([^>]*)>(.*?)</g>", src, re.S)
TW, TH = _vb[2], _vb[3]
def _clean(attrs):
    # the traced file already carries its own fill; keep only the geometry or we
    # emit a duplicate attribute and the whole svg fails to parse
    return " ".join(x for x in re.findall(r'[\w:-]+="[^"]*"', attrs)
                    if not x.startswith(("fill=", "stroke=")))
# potrace wraps its paths in its own transform with a scale of its own; a stroke
# width has to be divided by THAT too, or the keyline on the diamond comes out
# ten times too thin while the one on the circle looks right.
_inner = re.search(r'scale\(([-\d.]+)', _gs[0][0])
_ISCALE = abs(float(_inner.group(1))) if _inner else 1.0
_SIL_A, _SIL_P = _clean(_gs[0][0]), _gs[0][1]
_GLY_A, _GLY_P = _clean(_gs[1][0]), _gs[1][1]
_norm = 100.0 / TW                       # put the diamond in a 100-wide box
DH = TH * _norm                          # its height in that box

def diamond(x, y, scale, fill="#009393", glyph="#fff", uid="d"):
    """Place the traced diamond. glyph=None knocks the T out instead of filling
    it, so a one-colour mark still reads on any background."""
    s = scale * _norm
    if glyph is None:
        return (f'<g transform="translate({x} {y}) scale({s})">'
                f'<mask id="m{uid}"><g {_SIL_A} fill="#fff">{_SIL_P}</g>'
                f'<g {_GLY_A} fill="#000">{_GLY_P}</g></mask>'
                f'<g mask="url(#m{uid})"><g {_SIL_A} fill="{fill}">{_SIL_P}</g></g></g>')
    return (f'<g transform="translate({x} {y}) scale({s})">'
            f'<g {_SIL_A} fill="{fill}">{_SIL_P}</g>'
            f'<g {_GLY_A} fill="{glyph}">{_GLY_P}</g></g>')

def diamond_sil(x, y, scale, fill, uid="s", stroke=None, sw=0.0):
    """stroke width is given in OUTER units and divided by the group's scale,
    because a transform scales stroke-width too: an 8 unit keyline inside a
    0.0256 scale group comes out at 0.2 and vanishes."""
    s = scale * _norm
    sa = ""
    if stroke and sw:
        sa = f' stroke="{stroke}" stroke-width="{sw / (s * _ISCALE)}" stroke-linejoin="round"'
    return (f'<g transform="translate({x} {y}) scale({s})">'
            f'<g {_SIL_A} fill="{fill}"{sa}>{_SIL_P}</g></g>')

def coin(disc="#F7931A", glyph="#fff", uid="c"):
    if glyph is None:
        return (f'<mask id="k{uid}"><circle cx="32" cy="32" r="32" fill="#fff"/>'
                f'<g transform="rotate(-13.5 32 32)" fill="#000"><path d="{BG}"/></g></mask>'
                f'<circle cx="32" cy="32" r="32" fill="{disc}" mask="url(#k{uid})"/>')
    return (f'<circle cx="32" cy="32" r="32" fill="{disc}"/>'
            f'<g transform="rotate(-13.5 32 32)" fill="{glyph}"><path d="{BG}"/></g>')

# where the diamond sits on the coin, in the 88-unit icon box
DX, DY, DS = 40.0, 36.0, 0.47
WAYS = {
  "color": dict(disc="#F7931A", cg="#fff", dia="#009393", dg="#fff"),
  "white": dict(disc="#fff",    cg=None,   dia="#fff",    dg=None),
  "black": dict(disc="#111820", cg=None,   dia="#111820", dg=None),
}

def icon(way):
    w = WAYS[way]
    gap = (f'<mask id="g{way}"><rect width="88" height="88" fill="#fff"/>'
           f'{diamond_sil(DX, DY, DS, "#000", "gap"+way, "#000", 4.4)}</mask>')
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 88 88" width="88" height="88" '
            f'role="img" aria-label="ShaT Coin"><title>ShaT Coin</title><defs>{gap}</defs>'
            f'<g mask="url(#g{way})">{coin(w["disc"], w["cg"], way)}</g>'
            f'{diamond(DX, DY, DS, w["dia"], w["dg"], "i"+way)}</svg>\n')

def wordmark(way, coin_ink):
    w = WAYS[way]
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 980 240" width="980" height="240" '
            f'role="img" aria-label="ShaT Coin"><title>ShaT Coin</title>'
            f'<style>.s{{font:800 170px Inter,"Helvetica Neue",Arial,sans-serif;letter-spacing:-5px}}'
            f'.c{{font:800 120px Inter,"Helvetica Neue",Arial,sans-serif;letter-spacing:-4px}}</style>'
            f'<text class="s" x="0" y="178" fill="{w["disc"] if way!="color" else "#F7931A"}">Sha</text>'
            f'{diamond(300, 48, 1.42, w["dia"], w["dg"], "w"+way)}'
            f'<text class="c" x="492" y="178" fill="{coin_ink}">Coin</text></svg>\n')

if __name__ == "__main__":
    for way in WAYS:
        open(os.path.join(HERE, f"shat-icon-{way}.svg"), "w").write(icon(way))
    open(os.path.join(HERE, "shat-wordmark-color-on-dark.svg"), "w").write(wordmark("color", "#FFFFFF"))
    open(os.path.join(HERE, "shat-wordmark-color-on-light.svg"), "w").write(wordmark("color", "#111820"))
    open(os.path.join(HERE, "shat-wordmark-white.svg"), "w").write(wordmark("white", "#FFFFFF"))
    open(os.path.join(HERE, "shat-wordmark-black.svg"), "w").write(wordmark("black", "#111820"))
    print("  rebuilt 3 icons and 4 wordmarks from the traced diamond")

# ---------------------------------------------------------------- stickers
BLEED_IN = 0.125        # what printers ask for; a fixed distance, never a ratio
BORDER   = 4.0          # the white keyline, in icon units
CUT_LW   = 0.5

SIZES = [("1in", 1.0), ("1.5in", 1.5), ("2in", 2.0), ("2.5in", 2.5),
         ("3in", 3.0), ("4in", 4.0),
         ("25mm", 25/25.4), ("50mm", 50/25.4), ("75mm", 75/25.4), ("100mm", 100/25.4)]

def _art():
    return (f'<circle cx="32" cy="32" r="32" fill="#F7931A"/>'
            f'<g transform="rotate(-13.5 32 32)" fill="#fff"><path d="{BG}"/></g>'
            + diamond(DX, DY, DS, "#009393", "#fff", "sk"))

def _sil(fill, uid, stroke=None, sw=0.0):
    c = f'<circle cx="32" cy="32" r="32" fill="{fill}"'
    c += (f' stroke="{stroke}" stroke-width="{sw}" stroke-linejoin="round"' if stroke and sw else '') + '/>'
    return c + diamond_sil(DX, DY, DS, fill, uid, stroke, sw)

def sticker_diecut(inches, cutline, label):
    art = 88 + 2*BORDER
    bu  = BLEED_IN * art / inches
    pad = BORDER + bu
    side = 88 + 2*pad
    phys = inches * side / art
    # The cut follows the outer edge of the white keyline. SVG cannot offset a
    # path, so stroke the silhouette fat in magenta then again slightly thinner
    # in white: a hairline ring survives exactly where the blade goes.
    cut = (f'<g id="CutContour">'
           + _sil("none", "cA"+label, "#FF00FF", BORDER*2)
           + _sil("none", "cB"+label, "#fff", BORDER*2-CUT_LW)
           + '</g>') if cutline else ''
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{-pad} {-pad} {side} {side}" '
            f'width="{phys:.4f}in" height="{phys:.4f}in">'
            + _sil("#fff", "bl"+label, "#fff", (BORDER+bu)*2)
            + _sil("#fff", "kl"+label, "#fff", BORDER*2)
            + f'{cut}{_art()}</svg>\n'), phys

def sticker_circle(inches, cutline, label):
    R = 56.0
    bu = BLEED_IN * (2*R) / inches
    s  = R + bu
    phys = inches * (2*s) / (2*R)
    cut = (f'<circle id="CutContour" cx="0" cy="0" r="{R-CUT_LW/2}" fill="none" '
           f'stroke="#FF00FF" stroke-width="{CUT_LW}" stroke-dasharray="3 2"/>') if cutline else ''
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{-s} {-s} {2*s} {2*s}" '
            f'width="{phys:.4f}in" height="{phys:.4f}in">'
            f'<circle cx="0" cy="0" r="{s}" fill="#fff"/>'
            f'<g transform="translate(-44 -44)">{_art()}</g>{cut}</svg>\n'), phys

def build_stickers():
    out = os.path.join(HERE, "print")
    os.makedirs(out, exist_ok=True)
    made = []
    for name, inches in SIZES:
        for kind, fn in (("diecut", sticker_diecut), ("circle", sticker_circle)):
            for cut in (False, True):
                tag = "-cutline" if cut else ""
                svg, phys = fn(inches, cut, f"{kind}{name}{int(cut)}")
                f = os.path.join(out, f"shat-sticker-{kind}-{name}{tag}.svg")
                open(f, "w").write(svg)
                made.append([kind, name, inches, cut, f, phys])
    json.dump(made, open("/tmp/stickers.json", "w"))
    return made
