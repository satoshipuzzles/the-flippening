ShaT Coin sticker artwork
=========================

SVG and PDF are both vector and both at the finished size with bleed. Send
whichever your printer prefers; many prefer SVG. PNGs are 300 dpi, for shops
that will not take vector. All lettering is outlines, not live type, so nothing
depends on a font at the printer's end.

DESIGNS
  wordmark      "ShaT Coin" in full, die cut around the lettering
  icon          the coin with the Tether diamond, die cut to the shape
  slogan        "BITCOIN not BTC", die cut, with the Tether diamond standing in
                for the T the same way it does in the wordmark

SIZES
  wordmark  2, 3, 4, 5, 6 in and 50, 75, 100, 150 mm   (that is the WIDTH)
  icon      1, 1.5, 2, 2.5, 3, 4 in and 25, 50, 75, 100 mm
  slogan    1.5, 2, 3, 4 in and 50, 75, 100 mm         (that is the WIDTH)
  The number in the filename is the FINISHED size after cutting.

BLEED
  0.125 in (3.18 mm) every side, already included, so the artboard is 0.25 in
  larger than the finished sticker, the same physical distance at every size.
  The white keyline around the die cut designs is part of the artwork, not bleed.

CUT LINE
  Files ending -cutline draw the blade path in magenta in a layer named
  CutContour. The die cut paths are a single closed contour with no interior
  loops, so a blade can follow them. Send the plain files if the printer makes
  their own die line.

COLOURS
  orange #F7931A, teal #009393, gold #D4AF37, ink #111820, grey #6b7a90.
  Supplied in RGB; ask for CMYK conversion if they need it and expect the
  orange to lose a little punch.

Regenerating these files
------------------------
  python3 brand/build.py         writes every SVG (and the manifest)
  python3 brand/render_print.py  renders each SVG to a print PDF and a 300 dpi PNG
  python3 brand/trace_cut.py [r] re-traces the slogan die line (r = close radius, default 55)

Both renderers go through headless Chrome on purpose. ImageMagick here has no
librsvg delegate and quietly falls back to its own renderer, which ignores a
stroke set on a <g> - the white keyline and the bleed disappear with no error.
