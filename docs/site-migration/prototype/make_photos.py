"""img/ 内の画像を data URI にまとめて photos.json を作る（build.py の前に実行）。"""
import base64, glob, json, os
here = os.path.dirname(os.path.abspath(__file__))
out = {}
for f in sorted(glob.glob(os.path.join(here, "img", "*"))):
    k, ext = os.path.splitext(os.path.basename(f))
    mime = {".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg"}[ext]
    out[k] = "data:" + mime + ";base64," + base64.b64encode(open(f, "rb").read()).decode()
json.dump(out, open(os.path.join(here, "photos.json"), "w"))
print(len(out), "assets ->", "photos.json")
