'use client'

import { motion } from "framer-motion"
import React, { useMemo } from "react"

interface FilledFolderProps {
    folderName: string
    folderQuantity: number
}

const FilledFolder: React.FC<FilledFolderProps> = ({
                                                       folderName,
                                                       folderQuantity,
                                                   }) => {
    // One random rotation per render (symmetrical)
    const sideRotation = useMemo(() => {
        return Math.random() * 12 + 12
    }, [])

    return (
        <motion.div
            whileHover="hover"
            initial="rest"
            animate="rest"
            className="
                relative
                rounded-lg
                cursor-pointer
                border border-transparent hover:border-white/10
                duration-300 transition-all
                hover:bg-white/5
                flex flex-col items-center justify-between
                p-4 text-center

                /* responsive sizing */
                w-40 h-40
                sm:w-48 sm:h-48
                md:w-56 md:h-56
                lg:w-64 lg:h-64
            "
            style={{
                // single scale source of truth
                // tweak if you want tighter/looser stacks
                // @ts-ignore
                '--folder-scale': '1',
            }}
        >
            {/* Folder visual */}
            <div
                className="
                    relative
                    aspect-square
                "
                style={{
                    width: 'calc(11rem * var(--folder-scale))',
                }}
            >
                {/* Folder line */}
                <img
                    src="/custom/folder_line.png"
                    alt="folder-line"
                    className="
                        absolute
                        bottom-[35%]
                        left-1/2 -translate-x-1/2
                        opacity-75
                        z-50
                        w-[90%]
                    "
                />

                {/* Folder back */}
                <img
                    src="/custom/folder_back.png"
                    alt="folder-back"
                    className="absolute inset-0 w-full z-10"
                />

                {/* Left sheet */}
                <motion.img
                    src="/custom/folder_sheet.png"
                    alt="folder-sheet-left"
                    className="absolute left-1/2 -translate-x-1/2 z-20 pointer-events-none"
                    style={{
                        width: 'calc(5rem * var(--folder-scale))',
                        x: '-18%',
                    }}
                    variants={{
                        rest: {
                            y: '22%',
                            scale: 0.96,
                            rotate: 0,
                        },
                        hover: {
                            y: '-12%',
                            scale: 1,
                            rotate: -sideRotation,
                        },
                    }}
                    transition={{
                        duration: 0.15,
                        delay: 0.08,
                        ease: 'easeOut',
                    }}
                />

                {/* Center sheet */}
                <motion.img
                    src="/custom/folder_sheet_text.png"
                    alt="folder-sheet-center"
                    className="absolute left-1/2 -translate-x-1/2 z-30 pointer-events-none"
                    style={{
                        width: 'calc(5rem * var(--folder-scale))',
                    }}
                    variants={{
                        rest: {
                            y: '22%',
                            scale: 0.96,
                        },
                        hover: {
                            y: '-26%',
                            scale: 1,
                        },
                    }}
                    transition={{
                        duration: 0.15,
                        ease: 'easeOut',
                    }}
                />

                {/* Right sheet */}
                <motion.img
                    src="/custom/folder_sheet.png"
                    alt="folder-sheet-right"
                    className="absolute left-1/2 -translate-x-1/2 z-20 pointer-events-none"
                    style={{
                        width: 'calc(5rem * var(--folder-scale))',
                        x: '18%',
                    }}
                    variants={{
                        rest: {
                            y: '22%',
                            scale: 0.96,
                            rotate: 0,
                        },
                        hover: {
                            y: '-12%',
                            scale: 1,
                            rotate: sideRotation,
                        },
                    }}
                    transition={{
                        duration: 0.15,
                        delay: 0.12,
                        ease: 'easeOut',
                    }}
                />

                {/* Folder front */}
                <img
                    src="/custom/folder_front.png"
                    alt="folder-front"
                    className="
                        absolute inset-0
                        w-full
                        z-40
                        translate-y-[4%]
                        scale-120
                    "
                />
            </div>

            {/* Text */}
            <div className="flex gap-1 flex-col">
                <p className="font-semibold leading-tight">{folderName}</p>
                <p className="text-white/50 text-sm">
                    {folderQuantity} {folderQuantity === 1 ? 'file' : 'files'}
                </p>
            </div>
        </motion.div>
    )
}

export default FilledFolder
