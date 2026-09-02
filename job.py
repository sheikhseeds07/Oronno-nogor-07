import io, os, re, urllib.request
from PIL import Image

B = "https://bvuhvzccziuniujeogng.supabase.co/storage/v1/object/sign/banners/"
LOGO = B + "branding/1788375077191-836.webp?token=eyJraWQiOiIwY2QzMWY5OC04YzI5LTRhOGUtOTkxOS05MTI0MWJkOWJjNzYiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJiYW5uZXJzL2JyYW5kaW5nLzE3ODgzNzUwNzcxOTEtODM2LndlYnAiLCJzY29wZSI6ImRvd25sb2FkIiwiaWF0IjoxNzg4Mzc1MDc4LCJleHAiOjIxMDM3MzUwNzh9.fJRvR7fj9OHMD7NhE9I-LJB8wQQ_RwWzMzfJu-afIjI"
OG = B + "seo/1788374909065-836.webp?token=eyJraWQiOiIwY2QzMWY5OC04YzI5LTRhOGUtOTkxOS05MTI0MWJkOWJjNzYiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJiYW5uZXJzL3Nlby8xNzg4Mzc0OTA5MDY1LTgzNi53ZWJwIiwic2NvcGUiOiJkb3dubG9hZCIsImlhdCI6MTc4ODM3NDkxMCwiZXhwIjoyMTAzNzM0OTEwfQ.wTKIMIpVrWSgcRrUSix6duixHNb07vGO2qZTk9H41XI"


def fetch(u):
    r = urllib.request.Request(u, headers={"User-Agent": "gha"})
    return Image.open(io.BytesIO(urllib.request.urlopen(r).read()))


logo = fetch(LOGO).convert("RGBA")
bg = Image.new("RGBA", logo.size, (255, 255, 255, 255))
bg.alpha_composite(logo)
logo = bg.convert("RGB")
for s, n in [(32, "public/favicon-32-v2.png"), (192, "public/icon-192-v2.png"),
             (512, "public/icon-512-v2.png"), (180, "public/apple-touch-icon-v2.png"),
             (512, "public/favicon.png")]:
    logo.resize((s, s), Image.LANCZOS).save(n, "PNG", optimize=True)
logo.resize((256, 256), Image.LANCZOS).save("public/favicon.ico", sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
for n in ["public/logo.jpg", "src/assets/logo.jpg"]:
    if os.path.exists(n):
        logo.resize((512, 512), Image.LANCZOS).save(n, "JPEG", quality=90, optimize=True)

og = fetch(OG).convert("RGB")
c = Image.new("RGB", (1200, 630), (255, 255, 255))
w = int(og.width * 630 / og.height)
c.paste(og.resize((w, 630), Image.LANCZOS), ((1200 - w) // 2, 0))
c.save("public/og-sheikh-seeds.jpg", "JPEG", quality=88, optimize=True)
if os.path.exists("public/og-oronno-nogor.jpg"):
    os.remove("public/og-oronno-nogor.jpg")

TEXT = []
for root, dirs, files in os.walk("."):
    if any(x in root for x in (".git", "node_modules", "supabase/migrations", ".github")):
        continue
    for f in files:
        if f.endswith((".ts", ".tsx", ".txt", ".md", ".webmanifest", ".json")):
            TEXT.append(os.path.join(root, f))

SEO_FILES = ("./src/routes/__root.tsx", "./src/lib/sitemap.server.ts",
             "./src/routes/product.$slug.tsx", "./public/robots.txt", "./README.md")


def edit(path, fn):
    if not os.path.exists(path):
        return
    s = open(path, encoding="utf-8").read()
    n = fn(s)
    if n != s:
        open(path, "w", encoding="utf-8").write(n)


for p in TEXT:
    s = open(p, encoding="utf-8").read()
    o = s
    if p in SEO_FILES:
        s = s.replace("https://oronnonogor.com", "https://sheikhseeds.com")
    s = s.replace("og-oronno-nogor.jpg", "og-sheikh-seeds.jpg")
    s = s.replace("info@oronnonogor.com", "info@sheikhseeds.com")
    s = s.replace('"/sheikh-seeds-logo.svg"', '"/icon-512-v2.png"')
    if s != o:
        open(p, "w", encoding="utf-8").write(s)

R = "./src/routes/__root.tsx"


def head(s):
    s = s.replace('{rel:"icon",type:"image/svg+xml",href:"/icon-512-v2.png"}',
                  '{rel:"icon",type:"image/png",sizes:"32x32",href:"/favicon-32-v2.png"},'
                  '{rel:"icon",type:"image/png",sizes:"512x512",href:"/icon-512-v2.png"},'
                  '{rel:"shortcut icon",href:"/favicon.ico"}')
    s = s.replace('{rel:"apple-touch-icon",href:"/icon-512-v2.png"}',
                  '{rel:"apple-touch-icon",sizes:"180x180",href:"/apple-touch-icon-v2.png"}')
    a = '{name:"theme-color",content:"#0d4a29"}'
    if "og:image" not in s and a in s:
        s = s.replace(a, a
                      + ',{property:"og:url",content:"https://sheikhseeds.com/"}'
                      + ',{property:"og:image",content:"https://sheikhseeds.com/og-sheikh-seeds.jpg"}'
                      + ',{property:"og:image:width",content:"1200"}'
                      + ',{property:"og:image:height",content:"630"}'
                      + ',{property:"og:image:alt",content:"Sheikh Seeds"}'
                      + ',{name:"twitter:card",content:"summary_large_image"}'
                      + ',{name:"twitter:image",content:"https://sheikhseeds.com/og-sheikh-seeds.jpg"}', 1)
    return s


edit(R, head)


def man(s):
    return s.replace('"sizes": "any", "type": "image/svg+xml"', '"sizes": "512x512", "type": "image/png"')


edit("./public/admin.webmanifest", man)


def robots(s):
    lines = [l for l in s.splitlines() if not l.strip().lower().startswith("sitemap:")]
    while lines and not lines[-1].strip():
        lines.pop()
    return "\n".join(lines) + "\n\nSitemap: https://sheikhseeds.com/sitemap.xml\n"


edit("./public/robots.txt", robots)
print("done")
