import re, sys
sys.argv = ['x', 'content', 'page', '14']
import importlib.util
spec = importlib.util.spec_from_file_location("p", "/tmp/claude-0/-home-user-gotochi-reishoku-admin/061a4166-4be4-5226-ab62-8880a6b922b1/scratchpad/parse_wxr.py")
# Simpler: re-parse directly
import xml.etree.ElementTree as ET
F = "/root/.claude/uploads/061a4166-4be4-5226-ab62-8880a6b922b1/6d90ca6a-WordPress.20260910.xml"
NS = {'wp': 'http://wordpress.org/export/1.2/', 'content': 'http://purl.org/rss/1.0/modules/content/'}
ch = ET.parse(F).getroot().find('channel')
home = None
for it in ch.findall('item'):
    if it.find('wp:post_id', NS).text == '14':
        home = it
meta = {m.find('wp:meta_key', NS).text: (m.find('wp:meta_value', NS).text or '') for m in home.findall('wp:postmeta', NS)}
print("YOAST TITLE:", meta.get('_yoast_wpseo_title'))
print("YOAST DESC:", meta.get('_yoast_wpseo_metadesc'))
print("TEMPLATE:", meta.get('_wp_page_template'), "| header_style:", meta.get('_movedo_grve_header_style'), "| feature_section:", meta.get('_movedo_grve_feature_section'))
css = meta.get('_wpb_shortcodes_custom_css', '')
print("CUSTOM CSS len:", len(css))
print(css[:1500])
content = home.find('content:encoded', NS).text or ''
open('/tmp/claude-0/-home-user-gotochi-reishoku-admin/061a4166-4be4-5226-ab62-8880a6b922b1/scratchpad/home_raw.txt', 'w').write(content)
KEEP = {'el_id','image','link','title','heading','text','url','id','el_class','anchor','images','align','size','video_link','video_url','icon','ids','type','style','item','tab_id','value','number','label','href','src','full_width','bg_image','background','column_bg_image','bg_color'}
def simplify(m):
    tag = m.group(1); attrs = m.group(2) or ''
    kept = []
    for am in re.finditer(r'(\w+)="([^"]*)"', attrs):
        k, v = am.group(1), am.group(2)
        if k in KEEP:
            if len(v) > 160: v = v[:160] + '…'
            kept.append(f'{k}="{v}"')
    return '[' + tag + (' ' + ' '.join(kept) if kept else '') + ']'
out = re.sub(r'\[([a-zA-Z0-9_]+)((?:\s+[^\]]*)?)\]', simplify, content)
out = re.sub(r'\n{3,}', '\n\n', out)
print("SIMPLIFIED len:", len(out))
print(out)
