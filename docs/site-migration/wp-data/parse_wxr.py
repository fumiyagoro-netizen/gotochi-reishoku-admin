import sys, re, json, collections
import xml.etree.ElementTree as ET

F = "/root/.claude/uploads/061a4166-4be4-5226-ab62-8880a6b922b1/6d90ca6a-WordPress.20260910.xml"
NS = {
  'wp': 'http://wordpress.org/export/1.2/',
  'content': 'http://purl.org/rss/1.0/modules/content/',
  'excerpt': 'http://wordpress.org/export/1.2/excerpt/',
  'dc': 'http://purl.org/dc/elements/1.1/',
}
tree = ET.parse(F)
ch = tree.getroot().find('channel')

def t(el, path):
    x = el.find(path, NS)
    return (x.text or '') if x is not None else ''

items = ch.findall('item')
out = {}
att = []
for it in items:
    pt = t(it, 'wp:post_type')
    rec = {
      'id': t(it, 'wp:post_id'), 'title': t(it, 'title'), 'slug': t(it, 'wp:post_name'),
      'link': t(it, 'link'), 'status': t(it, 'wp:status'), 'date': t(it, 'wp:post_date'),
      'parent': t(it, 'wp:post_parent'), 'menu_order': t(it, 'wp:menu_order'),
      'content': t(it, 'content:encoded'), 'excerpt': t(it, 'excerpt:encoded'),
      'attachment_url': t(it, 'wp:attachment_url'),
      'meta': {t(m, 'wp:meta_key'): t(m, 'wp:meta_value') for m in it.findall('wp:postmeta', NS)},
      'terms': [(x.get('domain'), x.get('nicename'), x.text) for x in it.findall('category')],
    }
    if pt == 'attachment':
        att.append(rec)
    else:
        out.setdefault(pt, []).append(rec)

mode = sys.argv[1] if len(sys.argv) > 1 else 'summary'
if mode == 'summary':
    for pt, recs in out.items():
        print(f"\n##### {pt} ({len(recs)})")
        for r in recs:
            metakeys = [k for k in r['meta'].keys()]
            print(f"- id={r['id']} status={r['status']} date={r['date']} slug={r['slug']!r} title={r['title']!r} link={r['link']} parent={r['parent']} order={r['menu_order']} content_len={len(r['content'])} excerpt_len={len(r['excerpt'])}")
            print(f"    terms={r['terms']}")
            print(f"    meta_keys={metakeys}")
            # menu-specific meta
            if pt == 'nav_menu_item':
                m = r['meta']
                print(f"    menu: type={m.get('_menu_item_type')} object={m.get('_menu_item_object')} object_id={m.get('_menu_item_object_id')} url={m.get('_menu_item_url')} parent={m.get('_menu_item_menu_item_parent')}")
    # attachments summary
    print(f"\n##### attachments ({len(att)})")
    exts = collections.Counter()
    years = collections.Counter()
    for a in att:
        u = a['attachment_url']
        ext = u.rsplit('.',1)[-1].lower() if '.' in u else '?'
        exts[ext] += 1
        years[a['date'][:7]] += 1
    print("by ext:", dict(exts))
    print("by month:", dict(sorted(years.items())))
elif mode == 'attachments':
    for a in att:
        m = a['meta']
        print(f"{a['date'][:10]} id={a['id']} parent={a['parent']} title={a['title']!r} url={a['attachment_url']} alt={m.get('_wp_attachment_image_alt','')!r}")
elif mode == 'content':
    pt = sys.argv[2]; pid = sys.argv[3]
    for r in out.get(pt, []):
        if r['id'] == pid:
            print("=== TITLE:", r['title'], "| slug:", r['slug'], "| status:", r['status'])
            print("=== META:")
            for k, v in r['meta'].items():
                vv = v if len(v) < 300 else v[:300] + f"... [{len(v)} chars]"
                print(f"  {k}: {vv}")
            print("=== CONTENT:")
            print(r['content'])
            print("=== EXCERPT:")
            print(r['excerpt'])
