import type { Meta, StoryObj } from "@storybook/react";
import Tabs, { TabsList, TabsTrigger, TabsContent } from "@stellarUI/components/Tabs/Tabs";

const meta: Meta<typeof Tabs> = {
  title: "Containers/Tabs",
  component: Tabs,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Tabs>;

export const Default: Story = {
  render: () => (
    <Tabs defaultValue="account" className="w-[400px]">
      <TabsList>
        <TabsTrigger value="account">Account</TabsTrigger>
        <TabsTrigger value="password">Password</TabsTrigger>
      </TabsList>
      <TabsContent value="account">
        <p className="text-muted-foreground p-4 text-sm">Make changes to your account here.</p>
      </TabsContent>
      <TabsContent value="password">
        <p className="text-muted-foreground p-4 text-sm">Change your password here.</p>
      </TabsContent>
    </Tabs>
  ),
};

export const ThreeTabs: Story = {
  render: () => (
    <Tabs defaultValue="overview" className="w-[400px]">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="analytics">Analytics</TabsTrigger>
        <TabsTrigger value="reports">Reports</TabsTrigger>
      </TabsList>
      <TabsContent value="overview">
        <p className="text-muted-foreground p-4 text-sm">Overview content.</p>
      </TabsContent>
      <TabsContent value="analytics">
        <p className="text-muted-foreground p-4 text-sm">Analytics content.</p>
      </TabsContent>
      <TabsContent value="reports">
        <p className="text-muted-foreground p-4 text-sm">Reports content.</p>
      </TabsContent>
    </Tabs>
  ),
};
