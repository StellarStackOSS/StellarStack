"use client";

import * as React from "react";
import {
    ColumnDef,
    flexRender,
    Table as TanstackTable,
} from "@tanstack/react-table";
import { motion } from "framer-motion";

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
}

export function DataTable<TData>({
                                     table,
                                     columns,
                                     isLoading = false,
                                     emptyMessage = "No results.",
                                 }: DataTableProps<TData>) {
    const rows = table.getRowModel().rows;

    const bodyRef = React.useRef<HTMLTableSectionElement>(null);
    const [highlight, setHighlight] = React.useState<{
        top: number;
        height: number;
        visible: boolean;
    }>({ top: 0, height: 0, visible: false });

    return (
        <div className="rounded-lg border border-zinc-800/50 overflow-hidden bg-[#161616]">
            <Table className="w-full border-collapse">
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
                    {/* Floating highlight */}
                    <motion.div
                        className="
                            pointer-events-none
                            absolute left-1 right-1
                            rounded-md
                            bg-white/5
                            border border-white/10
                        "
                        animate={{
                            opacity: highlight.visible ? 1 : 0,
                            top: highlight.top,
                            height: highlight.height,
                        }}
                        transition={{
                            type: "spring",
                            stiffness: 520,
                            damping: 42,
                        }}
                    />

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
                        rows.map((row) => (
                            <TableRow
                                key={row.id}
                                onMouseEnter={(e) => {
                                    const bodyRect =
                                        bodyRef.current?.getBoundingClientRect();
                                    const rowRect =
                                        e.currentTarget.getBoundingClientRect();

                                    if (!bodyRect) return;

                                    setHighlight({
                                        top: rowRect.top - bodyRect.top + 4,
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
                            </TableRow>
                        ))
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
