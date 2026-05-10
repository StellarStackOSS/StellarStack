// ---------------------------------------------------------------------------
// Build-time blog post loader.
//
// Each `.md` file under `src/content/blog/` is imported as a raw string by
// Vite (`?raw`), then split into frontmatter + body by `parsePost`. The
// result is a sorted array indexable by slug.
//
// Frontmatter shape (YAML-ish, deliberately tiny — we only support the
// fields we use, no nested objects, no arrays except via `tags: a, b, c`):
//
//   ---
//   title: "Why we open-sourced StellarStack"
//   description: "Short hook that shows on the list page."
//   date: 2026-05-09
//   author: Marques
//   image: /blog/why-we-opensourced.png   # optional cover image
//   tags: announcement, ethos              # optional, comma-separated
//   ---
//
//   Body content here in Markdown. Images via standard syntax, the path
//   resolves against `apps/home/public/`.
//
//   ![Cover](/blog/cover.jpg)
//
// Slug is derived from the filename (no extension). Posts are sorted
// newest-first by `date`.
// ---------------------------------------------------------------------------

const RAW_POSTS = import.meta.glob("/src/content/blog/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>

export type BlogPostMeta = {
  slug: string
  title: string
  description: string
  date: string
  author: string
  image?: string
  tags: string[]
}

export type BlogPost = BlogPostMeta & {
  body: string
}

const FRONTMATTER_RE = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/

const parsePost = (raw: string, slug: string): BlogPost => {
  const match = FRONTMATTER_RE.exec(raw)
  if (match === null) {
    return {
      slug,
      title: slug,
      description: "",
      date: "1970-01-01",
      author: "",
      tags: [],
      body: raw,
    }
  }
  const fm: Record<string, string> = {}
  for (const line of match[1]!.split("\n")) {
    const sep = line.indexOf(":")
    if (sep < 0) continue
    const key = line.slice(0, sep).trim()
    let value = line.slice(sep + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    fm[key] = value
  }
  return {
    slug,
    title: fm["title"] ?? slug,
    description: fm["description"] ?? "",
    date: fm["date"] ?? "1970-01-01",
    author: fm["author"] ?? "",
    image: fm["image"],
    tags:
      fm["tags"] !== undefined
        ? fm["tags"]
            .split(",")
            .map((t) => t.trim())
            .filter((t) => t.length > 0)
        : [],
    body: match[2]!.trim(),
  }
}

const slugFromPath = (path: string): string => {
  const file = path.split("/").pop() ?? ""
  return file.replace(/\.md$/, "")
}

const POSTS: BlogPost[] = Object.entries(RAW_POSTS)
  .map(([path, raw]) => parsePost(raw, slugFromPath(path)))
  .sort((a, b) => (a.date < b.date ? 1 : -1))

export const listPosts = (): BlogPost[] => POSTS

export const getPost = (slug: string): BlogPost | undefined =>
  POSTS.find((p) => p.slug === slug)

export const formatPostDate = (iso: string): string => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}
