import sys
# Benötigt: pip install trimesh manifold3d shapely mapbox-earcut
import trimesh, numpy as np
from shapely.geometry import box, Point
from shapely import affinity

card_w, card_h, card_t, tol = 105, 140, 0.6, 0.8
wall, overlap, back_t, front_t, corner = 5, 4, 1.6, 1.6, 5
tab_w, tab_h = 40, 16
pocket_w, pocket_h, pocket_t = card_w + 2*tol, card_h + tol, card_t + 0.4
out_w = pocket_w + 2*wall
body_h = pocket_h + wall + overlap
total_t = back_t + pocket_t + front_t

def rrect(x, y, w, h, r):
    return box(x + r, y + r, x + w - r, y + h - r).buffer(r, resolution=16)

def ext(poly, z0, z1):
    m = trimesh.creation.extrude_polygon(poly, z1 - z0)
    m.apply_translation([0, 0, z0])
    return m

def union(ms):
    return trimesh.boolean.union(ms, engine='manifold')
def diff(a, b):
    return trimesh.boolean.difference([a, b], engine='manifold')

body = ext(rrect(0, 0, out_w, body_h, corner), 0, total_t)
tab = ext(rrect(out_w/2 - tab_w/2, body_h - 2, tab_w, tab_h + 2, 5), 0, back_t)
m = union([body, tab])
# Tasche (oben offen)
m = diff(m, ext(box(wall, wall + overlap, wall + pocket_w, body_h + 5), back_t, back_t + pocket_t))
# Fenster (vorn)
m = diff(m, ext(box(wall + overlap, wall + overlap, wall + pocket_w - overlap, body_h + 5), back_t + pocket_t - 0.01, total_t + 1))
# Loch in der Lasche
m = diff(m, ext(Point(out_w/2, body_h + tab_h/2 + 1).buffer(3, resolution=24), -1, total_t + 1))
# Schraubenlöcher
for x in (wall + 5, out_w - wall - 5):
    m = diff(m, ext(Point(x, (wall + overlap)/2).buffer(2, resolution=24), -1, total_t + 1))
m.export(sys.argv[1])
print('watertight', m.is_watertight, 'bounds', m.bounds.round(2).tolist(), 'volume cm3', round(m.volume/1000, 2))
