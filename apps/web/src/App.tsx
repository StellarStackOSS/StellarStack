import { Button } from "@workspace/ui/components/button"

/**
 * Root application component. Currently a placeholder shell — replaced by the
 * TanStack Router tree once auth + dashboard scaffolding lands.
 */
export const App = () => {
  return (
    <div className="flex min-h-svh p-6">
      <div className="flex max-w-md min-w-0 flex-col gap-4 text-sm leading-loose">
        <div>
          <h1 className="font-medium">StellarStack</h1>
          <p>Control panel scaffold ready.</p>
          <Button className="mt-2">Button</Button>
        </div>
        <div className="text-muted-foreground font-mono text-xs">
          (Press <kbd>d</kbd> to toggle dark mode)
        </div>
      </div>
    </div>
  )
}
