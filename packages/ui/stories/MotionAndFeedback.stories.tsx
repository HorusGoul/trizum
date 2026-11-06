import type { Meta, StoryObj } from "@storybook/react-vite";
import { useRef, useState } from "react";
import type { Key } from "react-aria-components";
import { toast } from "sonner";
import { AnimatedTabs } from "@trizum/ui/AnimatedTabs";
import { PullToRefresh } from "@trizum/ui/PullToRefresh";
import { Toaster } from "@trizum/ui/Toaster";
import { Button } from "@trizum/ui/Button";
import { useMediaQuery } from "@trizum/ui/useMediaQuery";

const meta = {
  title: "Components/Motion and feedback",
  parameters: {
    docs: {
      description: {
        component:
          "AnimatedTabs supports click and horizontal scroll. PullToRefresh needs the scrolling element ref and a refreshAction; use touch emulation to pull from the top. Toaster preserves the PWA’s dark toast treatment.",
      },
    },
  },
} satisfies Meta;

export default meta;

type Story = StoryObj;

function TabsExample() {
  const [selected, setSelected] = useState<Key>("first");

  return (
    <div className="h-64">
      <AnimatedTabs
        selectedTab={selected}
        onSelectedTabChange={setSelected}
        tabs={[
          {
            id: "first",
            label: "First",
            icon: "lucide.house",
            node: <p className="p-4">First panel</p>,
          },
          {
            id: "second",
            label: "Second",
            icon: "lucide.settings",
            node: <p className="p-4">Second panel</p>,
          },
        ]}
      />
    </div>
  );
}

export const Tabs: Story = { render: () => <TabsExample /> };

function RefreshExample() {
  const ref = useRef<HTMLDivElement>(null);
  const [count, setCount] = useState(0);

  return (
    <div ref={ref} className="h-80 overflow-auto overscroll-contain">
      <PullToRefresh
        scrollElementRef={ref}
        refreshAction={async () => {
          setCount((value) => value + 1);
        }}
      >
        <p>Pull down to refresh. Refreshed {count} times.</p>
        <div className="h-96" />
      </PullToRefresh>
    </div>
  );
}

export const Refresh: Story = { render: () => <RefreshExample /> };

export const Toasts: Story = {
  render: () => (
    <>
      <Toaster />
      <div className="flex flex-col gap-2">
        <Button
          onPress={() => toast.success("Saved", { description: "Changes are stored locally" })}
        >
          Success
        </Button>
        <Button onPress={() => toast.error("Unable to save")}>Error</Button>
        <Button onPress={() => toast.warning("Check your connection")}>Warning</Button>
        <Button onPress={() => toast.info("Update available")}>Information</Button>
      </div>
    </>
  ),
};

function MediaQueryExample() {
  const wide = useMediaQuery("(min-width: 768px)");

  return <p>Viewport: {wide ? "wide" : "compact"}. Resize to update.</p>;
}

export const ResponsiveHook: Story = { render: () => <MediaQueryExample /> };
