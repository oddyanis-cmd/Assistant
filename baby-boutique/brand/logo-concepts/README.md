# YAOUA logo concepts (realistic yarn renders)

Transparent, full-resolution PNGs (with soft cast shadow) ready for web and print:

| File | Concept |
|---|---|
| `knit_logo.png` (+ `knit_logo_Y.png` mark) | 1 · Knit stitch — stockinette letters, crocheted edging, ribbed sage hem |
| `net_logo.png` (+ `net_logo_Y.png` mark) | 2 · Open net — hand-knotted netting framed in twisted cord, tasselled drawstring |
| `cord_logo.png` | 3 · Twisted cord — chunky 3-ply yarn lettering into a wound ball with a brass hook |
| `doily_logo.png` | 4 · Crochet doily — ivory cotton doily with the name in rust yarn |
| `stitch_logo.png` | 5 · Cross-stitch — floss on frayed Aida cloth with a threaded needle |

`*_hero.jpg` are the same logos photographed-style on linen.

`renderer/` regenerates everything (Python 3, numpy, scipy, pillow, scikit-image):
`python render_cord.py` (etc.), `WORD=Y python render_knit.py` for the single-letter mark, then `python compose.py` for the mockups.
Every strand is rendered as a lit 3D tube with ply twist, fibre texture, ambient occlusion, loose fibres and cast shadows.
