import re, json
S="/tmp/claude-0/-home-user-gotochi-reishoku-admin/061a4166-4be4-5226-ab62-8880a6b922b1/scratchpad"
att = {}
for line in open(f"{S}/attachments.txt"):
    m = re.match(r"(\S+) id=(\d+) parent=(\d+) title='(.*?)' url=(\S+) alt='(.*?)'$", line.rstrip("\n"))
    if m: att[m.group(2)] = dict(date=m.group(1), title=m.group(4))
home = open(f"{S}/home_raw.txt").read()
sec = home[home.index('過去受賞商品'):home.index('協賛・協力パートナー')]
regions = re.findall(r'\[movedo_title[^\]]*heading="h5"[^\]]*\](.*?)\[/movedo_title\](.*?)(?=\[movedo_title|\[movedo_empty_space\]\[/vc_column\])', sec, re.S)
out = []
seen = set()
for ri, (name, body) in enumerate(regions):
    for i in re.findall(r'image="(\d+)"', body):
        a = att.get(i)
        if not a: continue
        title = a['title'].strip()
        # normalise a few obvious upload-name artefacts
        if title in seen: 
            continue
        seen.add(title)
        edition = 1 if a['date'].startswith('2025') else 2
        out.append({"n": title, "r": ri, "e": edition})
json.dump(out, open(f"{S}/winners.json", "w"), ensure_ascii=False, separators=(",", ":"))
print(len(out), "products;", "regions:", [r[0].strip() for r in regions])
print("bytes:", len(open(f"{S}/winners.json").read().encode()))
print(json.dumps(out[:3], ensure_ascii=False))
