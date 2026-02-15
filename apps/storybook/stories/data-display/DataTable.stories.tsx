import type { Meta, StoryObj } from "@storybook/react";
import DataTable from "@stellarUI/components/DataTable/DataTable";
import {
  useReactTable,
  getCoreRowModel,
  type ColumnDef,
} from "@tanstack/react-table";
import { useMemo } from "react";

interface MockUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

const MOCK_USERS: MockUser[] = [
  { id: "1", name: "Alice", email: "alice@example.com", role: "Admin" },
  { id: "2", name: "Bob", email: "bob@example.com", role: "User" },
  { id: "3", name: "Charlie", email: "charlie@example.com", role: "User" },
  { id: "4", name: "Diana", email: "diana@example.com", role: "Moderator" },
];

const COLUMNS: ColumnDef<MockUser, unknown>[] = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "email", header: "Email" },
  { accessorKey: "role", header: "Role" },
];

const DataTableWrapper = ({
  data = MOCK_USERS,
  isLoading = false,
  emptyMessage,
}: {
  data?: MockUser[];
  isLoading?: boolean;
  emptyMessage?: string;
}) => {
  const columns = useMemo(() => COLUMNS, []);
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="w-[600px]">
      <DataTable
        table={table}
        columns={columns}
        isLoading={isLoading}
        emptyMessage={emptyMessage}
      />
    </div>
  );
};

const meta: Meta<typeof DataTableWrapper> = {
  title: "Data Display/DataTable",
  component: DataTableWrapper,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof DataTableWrapper>;

export const Default: Story = {
  render: () => <DataTableWrapper />,
};

export const Loading: Story = {
  render: () => <DataTableWrapper isLoading />,
};

export const Empty: Story = {
  render: () => <DataTableWrapper data={[]} emptyMessage="No users found." />,
};
