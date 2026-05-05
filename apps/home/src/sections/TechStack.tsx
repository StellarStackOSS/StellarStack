import {
  Card,
  CardContent,
  CardHeader,
  CardInner,
  CardTitle,
} from "@workspace/ui/components/card"

const rows: Array<[string, string]> = [
  ["Package manager", "pnpm"],
  ["Monorepo", "Turborepo"],
  ["API", "Hono on Node.js, better-auth"],
  ["Daemon", "Go, Docker engine API"],
  ["Frontend", "React 19, TypeScript, Vite"],
  ["Routing", "TanStack Router"],
  ["State", "TanStack Query, Zustand"],
  ["Styling", "Tailwind CSS 4, shadcn/ui, Radix UI"],
  ["DB", "Postgres + Drizzle ORM"],
  ["Cache", "Redis (status cache, queue glue)"],
  ["Editor", "Monaco"],
  ["Animations", "Motion (Framer Motion)"],
]

export const TechStack = () => {
  return (
    <section id="stack" className="flex flex-col gap-8">
      <header className="flex flex-col gap-2 text-center">
        <span className="text-xs font-medium uppercase tracking-[0.3em] text-zinc-500">
          Boring, modern, fast
        </span>
        <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
          Tech stack
        </h2>
      </header>
      <Card className="w-full">
        <CardHeader>
          <CardTitle>What's under the hood</CardTitle>
        </CardHeader>
        <CardContent>
          <CardInner className="p-0">
            <table className="w-full text-xs">
              <tbody>
                {rows.map(([k, v], i) => (
                  <tr
                    key={k}
                    className={
                      i < rows.length - 1
                        ? "border-b border-white/5"
                        : undefined
                    }
                  >
                    <td className="w-44 px-4 py-2.5 align-top font-medium text-zinc-400">
                      {k}
                    </td>
                    <td className="px-4 py-2.5 text-zinc-200">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardInner>
        </CardContent>
      </Card>
    </section>
  )
}
