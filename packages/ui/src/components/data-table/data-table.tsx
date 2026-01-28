"use client";

import * as React from "react";
import {
    ColumnDef,
    flexRender,
    Table as TanstackTable,
} from "@tanstack/react-table";
import { motion, AnimatePresence } from "framer-motion";

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "../table";
import { Spinner } from "@workspace/ui/components";

interface DataTableProps<TData> {
    table: TanstackTable<TData>;
    columns: ColumnDef<TData, any>[];
    isLoading?: boolean;
    emptyMessage?: string;
    animateRows?: boolean;
}

export function DataTable<TData>({
                                     table,
                                     columns,
                                     isLoading = false,
                                     emptyMessage = "No results.",
                                     animateRows = true,
                                 }: DataTableProps<TData>) {
    const rows = table.getRowModel().rows;

    const bodyRef = React.useRef<HTMLTableSectionElement>(null);
    const containerRef = React.useRef<HTMLDivElement>(null);
    const [highlight, setHighlight] = React.useState<{
        top: number;
        height: number;
        visible: boolean;
    }>({ top: 0, height: 0, visible: false });

    return (
        <div ref={containerRef} className="rounded-lg border border-zinc-800/50 overflow-hidden bg-[#161616] relative">
            {/* Floating highlight */}
            <motion.div
                className="
                    pointer-events-none
                    absolute left-1 right-1 top-0
                    rounded-md
                    bg-white/5
                    border border-white/10
                    z-0
                "
                style={{ top: highlight.top }}
                animate={{
                    opacity: highlight.visible ? 1 : 0,
                    height: highlight.height,
                }}
                transition={{
                    type: "spring",
                    stiffness: 520,
                    damping: 42,
                }}
            />

            <Table className="w-full border-collapse relative">
                {/* Header */}
                <TableHeader className="bg-[#101010]">
                    {table.getHeaderGroups().map((headerGroup) => (
                        <TableRow
                            key={headerGroup.id}
                            className="border-b border-zinc-800/50"
                        >
                            {headerGroup.headers.map((header) => (
                                <TableHead key={header.id} className="px-4 py-3">
                                    {header.isPlaceholder
                                        ? null
                                        : flexRender(
                                            header.column.columnDef.header,
                                            header.getContext()
                                        )}
                                </TableHead>
                            ))}
                        </TableRow>
                    ))}
                </TableHeader>

                {/* Body */}
                <TableBody ref={bodyRef} className="relative">

                    {isLoading ? (
                        <TableRow>
                            <TableCell
                                colSpan={columns.length}
                                className="h-24 text-center text-sm text-zinc-500"
                            >
                                <Spinner />
                            </TableCell>
                        </TableRow>
                    ) : rows.length ? (
                        <AnimatePresence mode="popLayout">
                            {rows.map((row, index) => (
                                <motion.tr
                                    key={row.id}
                                    initial={animateRows ? { opacity: 0, x: 50 } : undefined}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={animateRows ? { opacity: 0, x: -50 } : undefined}
                                    transition={{
                                        duration: 0.3,
                                        delay: animateRows ? index * 0.05 : 0,
                                        ease: "easeOut",
                                    }}
                                    onMouseEnter={(e) => {
                                        const containerRect =
                                            containerRef.current?.getBoundingClientRect();
                                        const rowRect =
                                            e.currentTarget.getBoundingClientRect();

                                        if (!containerRect) return;

                                        setHighlight({
                                            top: rowRect.top - containerRect.top + 4,
                                            height: rowRect.height - 8,
                                            visible: true,
                                        });
                                    }}
                                    onMouseLeave={() =>
                                        setHighlight((h) => ({
                                            ...h,
                                            visible: false,
                                        }))
                                    }
                                    data-state={row.getIsSelected() && "selected"}
                                    className="relative"
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell
                                            key={cell.id}
                                            className="px-4 py-3 relative z-10"
                                        >
                                            {flexRender(
                                                cell.column.columnDef.cell,
                                                cell.getContext()
                                            )}
                                        </TableCell>
                                    ))}
                                </motion.tr>
                            ))}
                        </AnimatePresence>
                    ) : (
                        <TableRow>
                            <TableCell
                                colSpan={columns.length}
                                className="h-24 text-center text-sm text-zinc-500"
                            >
                                {emptyMessage}
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );
}
