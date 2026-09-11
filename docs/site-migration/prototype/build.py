"""proto.template.html の __WINNERS__ / __PHOTOS__ を埋めて gotouchi-2027-prototype.html を生成する。
   使い方: python3 make_photos.py && python3 build.py
"""
import os
here = os.path.dirname(os.path.abspath(__file__))
tpl = open(os.path.join(here, "proto.template.html"), encoding="utf-8").read()
out = (tpl.replace("__WINNERS__", open(os.path.join(here, "winners.json"), encoding="utf-8").read().strip())
          .replace("__PHOTOS__", open(os.path.join(here, "photos.json"), encoding="utf-8").read().strip()))
assert "__WINNERS__" not in out and "__PHOTOS__" not in out
open(os.path.join(here, "gotouchi-2027-prototype.html"), "w", encoding="utf-8").write(out)
print("built", len(out), "bytes")
