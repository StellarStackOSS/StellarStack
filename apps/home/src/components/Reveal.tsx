import type { ReactNode } from "react"
import { motion } from "framer-motion"

/**
 * Fade + lift on scroll-in. Wrap any block to give it a swanky entry.
 * Uses framer-motion's `whileInView` so it triggers once the element
 * scrolls past 30% of the viewport.
 */
export const Reveal = ({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode
  delay?: number
  className?: string
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, amount: 0.3 }}
    transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
    className={className}
  >
    {children}
  </motion.div>
)

export const RevealStagger = ({
  children,
  className,
  delay = 0.06,
}: {
  children: ReactNode
  className?: string
  delay?: number
}) => (
  <motion.div
    initial="hidden"
    whileInView="visible"
    viewport={{ once: true, amount: 0.2 }}
    variants={{
      hidden: {},
      visible: {
        transition: { staggerChildren: delay, delayChildren: 0.05 },
      },
    }}
    className={className}
  >
    {children}
  </motion.div>
)

export const RevealItem = ({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) => (
  <motion.div
    variants={{
      hidden: { opacity: 0, y: 20 },
      visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
      },
    }}
    className={className}
  >
    {children}
  </motion.div>
)
