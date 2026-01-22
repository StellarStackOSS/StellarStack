'use client';
import {
    Calendar, Cog,
    EthernetPort,
    Folder,
    FolderSync,
    House,
    Logs, MonitorCog,
    SquareSplitHorizontal,
    Users,
    Webhook,
    File, FileImage, FileArchive, FileCode, FileText
} from "lucide-react";
import {Checkbox, DataTable, Tooltip, TooltipContent, TooltipTrigger} from "@workspace/ui/components";
import {Providers} from "@/components/providers/providers";
import FilledFolder from "@/components/FilledFolder/FilledFolder";
import {getCoreRowModel, useReactTable} from "@tanstack/react-table";

const TestPage = () => {

    const FileTypeToIcon: Record<string, JSX.Element> = {
        folder: <Folder size={16} className="opacity-50" />,
        file: <File size={16} className="opacity-50" />,
        zip: <FileArchive size={18} className="opacity-50"  />,
        image: <FileImage size={18} className="opacity-50"  />,
        config: <FileCode size={18} className="opacity-50"  />,
        jar: <FileArchive size={18} className="opacity-50"  />,
        json: <FileCode size={18} className="opacity-50"  />,
        yml: <FileCode size={18} className="opacity-50"  />,
        log: <FileText size={18} className="opacity-50"  />,
    }



    const mockRows = [
        // folders
        { id: "1", name: "cache", type: "folder", size: "--", modified: "21/01/2026, 19:26:17" },
        { id: "2", name: "config", type: "folder", size: "--", modified: "21/01/2026, 19:27:03" },
        { id: "3", name: "libraries", type: "folder", size: "--", modified: "21/01/2026, 19:26:19" },
        { id: "4", name: "logs", type: "folder", size: "--", modified: "21/01/2026, 19:26:49" },
        { id: "5", name: "plugins", type: "folder", size: "--", modified: "21/01/2026, 19:27:03" },
        { id: "6", name: "versions", type: "folder", size: "--", modified: "21/01/2026, 19:26:20" },
        { id: "7", name: "world", type: "folder", size: "--", modified: "21/01/2026, 19:27:14" },
        { id: "8", name: "world_nether", type: "folder", size: "--", modified: "21/01/2026, 19:27:11" },
        { id: "9", name: "world_the_end", type: "folder", size: "--", modified: "21/01/2026, 19:27:12" },

        // files
        { id: "10", name: "banned-ips.json", type: "json", size: "2 B", modified: "21/01/2026, 19:27:03" },
        { id: "11", name: "banned-players.json", type: "json", size: "2 B", modified: "21/01/2026, 19:27:03" },
        { id: "12", name: "bukkit.yml", type: "yml", size: "1.1 KB", modified: "21/01/2026, 19:27:01" },
        { id: "13", name: "commands.yml", type: "yml", size: "491 B", modified: "21/01/2026, 19:27:01" },
        { id: "14", name: "eula.txt", type: "file", size: "157 B", modified: "21/01/2026, 19:26:43" },
        { id: "15", name: "help.yml", type: "yml", size: "2.8 KB", modified: "21/01/2026, 19:27:03" },
        { id: "16", name: "ops.json", type: "json", size: "2 B", modified: "21/01/2026, 19:27:03" },
        { id: "17", name: "permissions.yml", type: "yml", size: "0 B", modified: "21/01/2026, 19:27:03" },
        { id: "18", name: "server.jar", type: "jar", size: "52.3 MB", modified: "21/01/2026, 19:26:10" },
        { id: "19", name: "server.properties", type: "config", size: "1.6 KB", modified: "21/01/2026, 19:27:01" },
        { id: "20", name: "spigot.yml", type: "yml", size: "4.8 KB", modified: "21/01/2026, 19:27:12" },
        { id: "21", name: "usercache.json", type: "json", size: "2 B", modified: "21/01/2026, 19:27:03" },
        { id: "22", name: "version_history.json", type: "json", size: "53 B", modified: "21/01/2026, 19:27:03" },
        { id: "23", name: "whitelist.json", type: "json", size: "2 B", modified: "21/01/2026, 19:27:03" },
    ]


    const mockColumns = [
        {
            accessorKey: "checkbox",
            header: "",
            cell: () => <Checkbox />,
        },
        {
            accessorKey: "name",
            header: "Name",
            cell: ({ row }: any) => (
                <div className="flex items-center gap-3 text-sm font-medium">
                    {FileTypeToIcon[row.original.type] ?? FileTypeToIcon.file}
                    {row.original.name}
                </div>
            ),
        },
        {
            accessorKey: "size",
            header: "Size",
            cell: ({ row }: any) => (
                <span className="text-xs opacity-50">
        {row.original.size}
      </span>
            ),
        },
        {
            accessorKey: "modified",
            header: "Modified",
            cell: ({ row }: any) => (
                <span className="text-xs opacity-50">
        {row.original.modified}
      </span>
            ),
        },
    ]

    const table = useReactTable({
        data: mockRows,
        columns: mockColumns,
        getCoreRowModel: getCoreRowModel(),
    });


    return(
        <>
            <div className="bg-[#161616] text-white border-b border-white/10">
                <img src="/logo.png" alt="logo" className="w-16 p-2"/>
            </div>
            <div className="w-full flex flex-row">
                <div className="p-3 bg-[#161616] border-r items-=center border-white/10 flex flex-col gap-2">
                    <div
                        className="flex p-2 duration-300 transition-all text-white/30 hover:text-white items-center justify-center hover:bg-white/10 rounded-lg cursor-pointer">
                        <House size={22}/>
                    </div>
                    <div className="flex p-2 items-center justify-center bg-white/10 rounded-lg cursor-pointer">
                        <Tooltip>
                            <TooltipTrigger>
                                <Folder size={22}/>
                            </TooltipTrigger>
                            <TooltipContent side="right">
                                <p>Add to library</p>
                            </TooltipContent>
                        </Tooltip>
                    </div>
                    <div
                        className="flex p-2 text-white/30 items-center justify-center hover:bg-white/10 rounded-lg cursor-pointer">
                        <FolderSync size={22}/>
                    </div>
                    <div
                        className="flex p-2 text-white/30 items-center justify-center hover:bg-white/10 rounded-lg cursor-pointer">
                        <Calendar size={22}/>
                    </div>
                    <div
                        className="flex p-2 text-white/30 items-center justify-center hover:bg-white/10 rounded-lg cursor-pointer">
                        <Users size={22}/>
                    </div>
                    <div
                        className="flex p-2 text-white/30 items-center justify-center hover:bg-white/10 rounded-lg cursor-pointer">
                        <EthernetPort size={22}/>
                    </div>
                    <div
                        className="flex p-2 text-white/30 items-center justify-center hover:bg-white/10 rounded-lg cursor-pointer">
                        <House size={22}/>
                    </div>
                    <div
                        className="flex p-2 text-white/30 items-center justify-center hover:bg-white/10 rounded-lg cursor-pointer">
                        <Webhook size={22}/>
                    </div>
                    <div
                        className="flex p-2 text-white/30 items-center justify-center hover:bg-white/10 rounded-lg cursor-pointer">
                        <SquareSplitHorizontal size={22}/>
                    </div>
                    <div
                        className="flex p-2 text-white/30 items-center justify-center hover:bg-white/10 rounded-lg cursor-pointer">
                        <Logs size={22}/>
                    </div>
                    <div
                        className="flex p-2 text-white/30 items-center justify-center hover:bg-white/10 rounded-lg cursor-pointer">
                        <MonitorCog size={22}/>
                    </div>
                    <div
                        className="flex p-2 text-white/30 items-center justify-center hover:bg-white/10 rounded-lg cursor-pointer">
                        <Cog size={22}/>
                    </div>
                </div>
                <div className="w-64 p-3 bg-[#161616] border-r items-=center border-white/10">
                    dsajmdsamnkidsamdsa
                </div>
                <Providers>
                    <div className="w-full p-4">
                        <p className="text-2xl font-semibold pb-2">Folders</p>
                        {/*{children}*/}
                        <div className="flex flex-wrap w-full h-auto pt-2 gap-2">
                            <FilledFolder folderName="Movies" folderQuantity={12}/>
                            <FilledFolder folderName="Movies" folderQuantity={12}/>
                            <FilledFolder folderName="Movies" folderQuantity={12}/>
                            <FilledFolder folderName="Movies" folderQuantity={12}/>
                            <FilledFolder folderName="Movies" folderQuantity={12}/>
                            <FilledFolder folderName="Movies" folderQuantity={12}/>
                        </div>
                        <p className="text-2xl font-semibold py-2">Files</p>
                        <DataTable table={table} columns={mockColumns}/>
                    </div>
                </Providers>
            </div>
        </>
    )
}
export default TestPage;