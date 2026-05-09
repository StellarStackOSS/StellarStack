import { motion, type Variants } from "framer-motion"
import type { ReactNode } from "react"

const pageVariants: Variants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { duration: 0.18, ease: [0.22, 1, 0.36, 1] },
  },
}

const containerVariants: Variants = {
  initial: { opacity: 1 },
  animate: {
    transition: { staggerChildren: 0.04, delayChildren: 0.05 },
  },
}

const itemVariants: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] },
  },
}

/**
 * Wrap an outlet with `<PageTransition>` (with a key) inside an
 * `<AnimatePresence mode="wait">` to fade pages in/out on navigation.
 */
export const PageTransition = ({ children }: { children: ReactNode }) => (
  <motion.div
    variants={pageVariants}
    initial="initial"
    animate="animate"
    data-page-transition
    className="flex min-h-0 flex-1 flex-col"
  >
    {children}
  </motion.div>
)

/**
 * Use as the root of a page that wants its top-level children to fan
 * in. Pair with `<StaggerItem>` for each child you want animated.
 */
export const StaggerChildren = ({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) => (
  <motion.div
    variants={containerVariants}
    initial="initial"
    animate="animate"
    className={className}
  >
    {children}
  </motion.div>
)

export const StaggerItem = ({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) => (
  <motion.div variants={itemVariants} className={className}>
    {children}
  </motion.div>
)
