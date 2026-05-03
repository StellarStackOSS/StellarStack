import { createContext, useContext } from "react"

export const ConsoleScrollContext = createContext<number>(0)
export const useConsoleScrollSignal = () => useContext(ConsoleScrollContext)
