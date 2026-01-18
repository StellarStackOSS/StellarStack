"use client";

import * as React from "react";
import {ColumnDef, flexRender, Table as TanstackTable} from "@tanstack/react-table";

import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "../table";
import {Spinner} from "@workspace/ui/components";


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

  return (
    <div className="rounded-md border border-zinc-800/50">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow
              key={headerGroup.id}
              className="border-b border-zinc-800/50 hover:bg-transparent"
            >
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id} className="px-4 py-3">
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="h-24 text-center text-sm text-zinc-500"
              >
                <Spinner/>
              </TableCell>
            </TableRow>
          ) : rows.length ? (
            rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() && "selected"}
                className="border-b border-zinc-800/50 hover:bg-zinc-800/30 data-[state=selected]:bg-zinc-800/50"
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="px-4 py-3">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
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
