# StellarStack Implementation Rules

**CRITICAL - MUST FOLLOW AT ALL TIMES**

## Component & Styling Rules

✅ **ALWAYS**:
1. Use ONLY existing shadcn/ui components from `packages/ui`
2. Use default Tailwind color classes: `text-muted-foreground`, `bg-muted`, `border-border`, etc.
3. NO color overriding - never use specific colors like `text-red-500`, `text-green-500`, `bg-blue-900/80`
4. NO creating new UI components unless explicitly told
5. Name components with PascalCase: `ComponentName`
6. Use functional components: `const ComponentName = () => {}`
7. Add JSDoc comments to all functions and components
8. Share types in separate `types.ts` files
9. Avoid code duplication - extract shared logic into utility functions

❌ **NEVER**:
1. Create custom Button, Card, Badge, Dialog, etc. - use shadcn versions
2. Override colors with CSS classes or inline styles
3. Use hardcoded color values like `#3b82f6`, `#ef4444`, etc.
4. Create new component files when existing ones can be used
5. Use specific color names in classNames: `text-red-500`, `bg-green-900/80`, `fill-blue-500`, etc.
6. Add custom SVG or canvas elements when Recharts chart exists

## Code Quality Rules

✅ **ALWAYS**:
1. Add JSDoc comments to every function
2. Use TypeScript interfaces for props
3. Extract utility functions instead of duplicating code
4. Use React hooks correctly (useState, useMemo, useCallback)
5. Follow existing codebase patterns

## Example - Right Way vs Wrong Way

### ❌ WRONG: Creating custom component with color overrides
```tsx
// DON'T DO THIS
const CustomMetricsChart = () => (
  <svg>
    <polyline stroke="#3b82f6" className="stroke-blue-500" />
  </svg>
);
```

### ✅ RIGHT: Using existing Chart component from packages/ui
```tsx
// DO THIS
import { ChartContainer, LineChart, Line, XAxis, YAxis } from '@workspace/ui/components/chart';

const MetricsDisplay = () => (
  <ChartContainer config={{ value: { label: "Value" } }}>
    <LineChart data={data}>
      <XAxis dataKey="name" />
      <Line dataKey="value" />
    </LineChart>
  </ChartContainer>
);
```

### ❌ WRONG: Color overriding with specific classes
```tsx
// DON'T DO THIS
<Card className="bg-green-500/20 border-green-600/50">
  <span className="text-red-500">Error</span>
  <span className="text-yellow-500">Warning</span>
</Card>
```

### ✅ RIGHT: Using default color classes
```tsx
// DO THIS
<Card>
  <span className="text-muted-foreground">Normal text</span>
  <Badge>Default Badge</Badge>
</Card>
```

## Available Color Tokens (Shadcn/ui):
- Text: `text-foreground`, `text-muted-foreground`, `text-secondary-foreground`
- Background: `bg-background`, `bg-muted`, `bg-secondary`
- Border: `border-border`, `border-secondary`
- Accent: `text-accent`, `bg-accent`
- Destructive: `text-destructive`, `bg-destructive` (for errors/deletions)
- Success: Use Badge with default styling

## Verification Checklist Before Creating Files

Before writing ANY component file, check:
- [ ] Does a similar component exist in packages/ui?
- [ ] Am I using existing shadcn components?
- [ ] Are there any color overrides in my code?
- [ ] Did I add JSDoc comments to functions?
- [ ] Are types shared and not duplicated?
- [ ] Did I follow PascalCase for components?
- [ ] Am I using default Tailwind classes only?
- [ ] Did I test my implementation matches these rules?

---

**Last Updated**: January 24, 2026
**Status**: ACTIVE - ALL CODE MUST COMPLY
