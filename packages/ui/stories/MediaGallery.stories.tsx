import type { Meta, StoryObj } from "@storybook/react-vite";
import { Suspense, use, useState } from "react";
import MediaGallery, { MediaGalleryImage } from "@trizum/ui/MediaGallery";
import { MediaGalleryController } from "@trizum/ui/MediaGalleryController";
import { MediaGalleryContext } from "@trizum/ui/MediaGalleryContext";
import { GradientScan } from "@trizum/ui/QRCode";
import { Button } from "@trizum/ui/Button";

const meta = {
  title: "Components/Media gallery",
  parameters: {
    docs: {
      description: {
        component:
          "Gallery supports controlled selection, pinch zoom, drag dismissal, and custom rendering. Controller and context manage full-screen presentation. Built-in navigation labels use package catalogs; change locale in the toolbar.",
      },
    },
  },
} satisfies Meta;

export default meta;

type Story = StoryObj;

const items = [
  { src: new URL("../icons/illustration/shared-expenses.svg", import.meta.url).href },
  { src: new URL("../icons/brand/github.svg", import.meta.url).href },
];

function GalleryExample({ single = false }: { single?: boolean }) {
  const [index, setIndex] = useState(0);

  return (
    <div className="h-96">
      <MediaGallery
        items={single ? items.slice(0, 1) : items}
        index={index}
        onChange={setIndex}
        onClose={() => setIndex(0)}
      />
    </div>
  );
}

export const Default: Story = { render: () => <GalleryExample /> };
export const SingleImage: Story = { render: () => <GalleryExample single /> };

function OpenGallery() {
  const gallery = use(MediaGalleryContext);

  return (
    <Button onPress={() => gallery.open({ items, index: 0 })}>Open full-screen gallery</Button>
  );
}

export const FullScreen: Story = {
  render: () => (
    <MediaGalleryController>
      <OpenGallery />
    </MediaGalleryController>
  ),
};

export const Image: Story = {
  render: () => (
    <Suspense fallback={<p>Loading image</p>}>
      <MediaGalleryImage items={items} index={0} />
    </Suspense>
  ),
};

export const CustomRenderer: Story = {
  render: () => (
    <div className="h-64">
      <MediaGallery
        itemCount={1}
        getItemKey={(index) => index}
        index={0}
        onChange={() => {}}
        onClose={() => {}}
        showCloseButton={false}
        renderItem={() => <p>Custom media content</p>}
      />
    </div>
  ),
};

export const ScanDecoration: Story = {
  render: () => (
    <div className="relative h-64 overflow-hidden">
      <GradientScan />
    </div>
  ),
};
