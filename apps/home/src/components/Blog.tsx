import { type ComponentPropsWithoutRef } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

import {
  type BlogPost,
  formatPostDate,
  getPost,
  listPosts,
} from "@/lib/blog"

// ---------------------------------------------------------------------------
// List view — `#/blog`
// ---------------------------------------------------------------------------

export const BlogList = () => {
  const posts = listPosts()
  return (
    <main className="mx-auto w-[min(900px,92vw)] py-12 md:py-20">
      <header className="flex max-w-2xl flex-col gap-3">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#A397E8]">
          Blog
        </p>
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
          Notes from the team
        </h1>
        <p className="text-sm font-extralight leading-relaxed text-zinc-400">
          Build updates, deep dives, and the occasional opinion.
        </p>
      </header>

      {posts.length === 0 ? (
        <p className="mt-12 text-sm font-extralight text-zinc-500">
          No posts yet — check back soon.
        </p>
      ) : (
        <div className="mt-12 flex flex-col gap-3">
          {posts.map((post) => (
            <a
              key={post.slug}
              href={`#/blog/${post.slug}`}
              className="group flex flex-col gap-3 rounded-2xl border border-white/8 bg-[#201c19] p-6 transition-colors hover:border-white/15"
            >
              <div className="flex items-center gap-3 text-xs text-zinc-500">
                <time dateTime={post.date}>{formatPostDate(post.date)}</time>
                {post.author !== "" ? (
                  <>
                    <span aria-hidden>·</span>
                    <span>{post.author}</span>
                  </>
                ) : null}
                {post.tags.length > 0 ? (
                  <>
                    <span aria-hidden>·</span>
                    <span className="text-[#A397E8]">
                      {post.tags.join(", ")}
                    </span>
                  </>
                ) : null}
              </div>
              <h2 className="text-xl font-semibold tracking-tight transition-colors group-hover:text-white md:text-2xl">
                {post.title}
              </h2>
              {post.description !== "" ? (
                <p className="text-sm font-extralight leading-relaxed text-zinc-400">
                  {post.description}
                </p>
              ) : null}
            </a>
          ))}
        </div>
      )}
    </main>
  )
}

// ---------------------------------------------------------------------------
// Post view — `#/blog/<slug>`
// ---------------------------------------------------------------------------

const markdownComponents: Parameters<
  typeof ReactMarkdown
>[0]["components"] = {
  h1: (props) => (
    <h1
      {...props}
      className="mt-12 mb-4 text-2xl font-semibold tracking-tight md:text-3xl"
    />
  ),
  h2: (props) => (
    <h2
      {...props}
      className="mt-10 mb-3 text-xl font-semibold tracking-tight md:text-2xl"
    />
  ),
  h3: (props) => (
    <h3
      {...props}
      className="mt-8 mb-2 text-lg font-semibold tracking-tight"
    />
  ),
  p: (props) => (
    <p
      {...props}
      className="my-4 text-sm font-extralight leading-relaxed text-zinc-300 md:text-base"
    />
  ),
  ul: (props) => (
    <ul
      {...props}
      className="my-4 ml-5 flex list-disc flex-col gap-1.5 text-sm font-extralight leading-relaxed text-zinc-300 md:text-base"
    />
  ),
  ol: (props) => (
    <ol
      {...props}
      className="my-4 ml-5 flex list-decimal flex-col gap-1.5 text-sm font-extralight leading-relaxed text-zinc-300 md:text-base"
    />
  ),
  li: (props) => <li {...props} className="leading-relaxed" />,
  blockquote: (props) => (
    <blockquote
      {...props}
      className="my-6 border-l-2 border-[#A397E8] bg-white/[0.02] py-2 pl-4 text-sm font-extralight leading-relaxed text-zinc-400 md:text-base"
    />
  ),
  a: (props) => (
    <a
      {...props}
      className="text-[#A397E8] underline-offset-4 transition-opacity hover:opacity-80 hover:underline"
      target={
        typeof props.href === "string" && props.href.startsWith("http")
          ? "_blank"
          : undefined
      }
      rel={
        typeof props.href === "string" && props.href.startsWith("http")
          ? "noreferrer"
          : undefined
      }
    />
  ),
  code: ({
    className,
    children,
    ...props
  }: ComponentPropsWithoutRef<"code">) => {
    // react-markdown v9 wraps fenced code blocks in a `<pre>` and adds
    // `language-*` to the inner `<code>`. Inline code never gets that
    // className, so the absence of it is our "is inline" signal.
    const isBlock =
      typeof className === "string" && className.startsWith("language-")
    if (!isBlock) {
      return (
        <code
          {...props}
          className="rounded bg-white/8 px-1.5 py-0.5 font-mono text-[0.85em] text-[#A397E8]"
        >
          {children}
        </code>
      )
    }
    return (
      <code
        {...props}
        className={`${className} block overflow-x-auto font-mono text-[12.5px] leading-relaxed text-zinc-300`}
      >
        {children}
      </code>
    )
  },
  pre: (props) => (
    <pre
      {...props}
      className="my-6 overflow-x-auto rounded-lg border border-white/8 bg-[#0c0a08] p-4"
    />
  ),
  img: (props) => (
    <img
      {...props}
      className="my-8 w-full rounded-xl border border-white/8 shadow-2xl shadow-black/40"
      loading="lazy"
    />
  ),
  hr: (props) => (
    <hr {...props} className="my-10 border-t border-white/8" />
  ),
  table: (props) => (
    <div className="my-6 overflow-x-auto">
      <table
        {...props}
        className="w-full border-collapse text-sm font-extralight text-zinc-300"
      />
    </div>
  ),
  thead: (props) => <thead {...props} className="border-b border-white/8" />,
  th: (props) => (
    <th
      {...props}
      className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-zinc-500"
    />
  ),
  td: (props) => (
    <td {...props} className="border-b border-white/5 px-3 py-2" />
  ),
}

export const BlogPostView = ({ slug }: { slug: string }) => {
  const post = getPost(slug)
  if (post === undefined) {
    return (
      <main className="mx-auto w-[min(800px,92vw)] py-20 text-center">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#A397E8]">
          Blog
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
          Post not found
        </h1>
        <p className="mt-4 text-sm font-extralight text-zinc-400">
          The post you're looking for doesn't exist (yet).
        </p>
        <a
          href="#/blog"
          className="mt-8 inline-flex items-center gap-1.5 text-sm font-medium text-white transition-colors hover:text-[#A397E8]"
        >
          ← All posts
        </a>
      </main>
    )
  }
  return <ArticleBody post={post} />
}

const ArticleBody = ({ post }: { post: BlogPost }) => (
  <main className="mx-auto w-[min(760px,92vw)] py-12 md:py-20">
    <a
      href="#/blog"
      className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 transition-colors hover:text-white"
    >
      ← Back to blog
    </a>

    <header className="mt-8 flex flex-col gap-4">
      <div className="flex items-center gap-3 text-xs text-zinc-500">
        <time dateTime={post.date}>{formatPostDate(post.date)}</time>
        {post.author !== "" ? (
          <>
            <span aria-hidden>·</span>
            <span>{post.author}</span>
          </>
        ) : null}
        {post.tags.length > 0 ? (
          <>
            <span aria-hidden>·</span>
            <span className="text-[#A397E8]">{post.tags.join(", ")}</span>
          </>
        ) : null}
      </div>
      <h1 className="text-3xl font-semibold leading-[1.1] tracking-tight md:text-4xl">
        {post.title}
      </h1>
      {post.description !== "" ? (
        <p className="text-base font-extralight leading-relaxed text-zinc-400">
          {post.description}
        </p>
      ) : null}
      {post.image !== undefined ? (
        <img
          src={post.image}
          alt=""
          className="mt-4 w-full rounded-2xl border border-white/8 shadow-2xl shadow-black/40"
        />
      ) : null}
    </header>

    <article className="mt-8">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={markdownComponents}
      >
        {post.body}
      </ReactMarkdown>
    </article>
  </main>
)
