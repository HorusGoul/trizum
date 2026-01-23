import { useState } from "react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import {
  Button as AriaButton,
  Dialog,
  DialogTrigger,
  Input,
  ListBox,
  ListBoxItem,
  SearchField,
  Button as ClearButton,
  composeRenderProps,
} from "react-aria-components";
import { useVirtualizer } from "@tanstack/react-virtual";
import emojisData from "emojibase-data/en/compact.json";
import groupsData from "emojibase-data/meta/groups.json";
import { Popover } from "#src/ui/Popover.js";
import { cn } from "#src/ui/utils.js";
import { Icon } from "#src/ui/Icon.js";
import { DEFAULT_PARTY_SYMBOL } from "#src/models/party.ts";

type Emoji = (typeof emojisData)[0];

const GROUP_LABELS: Record<number, string> = {
  0: "Smileys & Emotion",
  1: "People & Body",
  2: "Component",
  3: "Animals & Nature",
  4: "Food & Drink",
  5: "Travel & Places",
  6: "Activities",
  7: "Objects",
  8: "Symbols",
  9: "Flags",
};

// Filter out regional indicators and component emojis (skin tones, hair styles)
const emojis: Emoji[] = emojisData.filter(
  (e) =>
    typeof e.label === "string" &&
    !e.label.startsWith("regional indicator") &&
    e.group !== 2,
);

// Group emojis by category
const groupedEmojis = emojis.reduce(
  (acc, emoji) => {
    const group = emoji.group ?? 0;
    if (!acc[group]) {
      acc[group] = [];
    }
    acc[group].push(emoji);
    return acc;
  },
  {} as Record<number, Emoji[]>,
);

// Get ordered list of groups that have emojis
const orderedGroups = Object.keys(groupsData.groups)
  .map(Number)
  .filter((g) => g !== 2 && groupedEmojis[g]?.length > 0)
  .sort((a, b) => a - b);

const GRID_COLUMNS = 8;
const CELL_SIZE = 36;
const GAP = 4;
const GRID_PADDING = 8;
const GRID_WIDTH =
  GRID_COLUMNS * CELL_SIZE + (GRID_COLUMNS - 1) * GAP + GRID_PADDING * 2;

interface EmojiPickerProps {
  value?: string;
  defaultValue?: string;
  onChange?: (emoji: string) => void;
  "aria-label"?: string;
  className?: string;
}

export function EmojiPicker({
  value,
  defaultValue = DEFAULT_PARTY_SYMBOL,
  onChange,
  "aria-label": ariaLabel,
  className,
}: EmojiPickerProps) {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const [searchQuery, setSearchQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const selectedEmoji = value ?? internalValue;

  const filteredEmojis = searchQuery
    ? emojis.filter((emoji) => {
        const query = searchQuery.toLowerCase();
        const labelMatch = emoji.label?.toLowerCase().includes(query);
        const tagsMatch =
          Array.isArray(emoji.tags) &&
          emoji.tags.some((tag) => tag.toLowerCase().includes(query));
        return labelMatch || tagsMatch;
      })
    : null;

  // When searching, show flat list; otherwise show by category
  const isSearching = searchQuery.length > 0;

  function handleSelect(emoji: string) {
    if (value === undefined) {
      setInternalValue(emoji);
    }
    onChange?.(emoji);
    setIsOpen(false);
    setSearchQuery("");
  }

  return (
    <DialogTrigger isOpen={isOpen} onOpenChange={setIsOpen}>
      <AriaButton
        aria-label={ariaLabel ?? t`Select emoji`}
        className={composeRenderProps(className, (className) =>
          cn(
            "flex h-10 w-10 items-center justify-center rounded-md border border-accent-500 bg-white text-2xl ring-offset-white transition-all dark:border-accent-700 dark:bg-accent-900 dark:ring-offset-accent-900",
            "data-[hovered]:bg-accent-100 dark:data-[hovered]:bg-accent-800",
            "data-[focus-visible]:outline-none data-[focus-visible]:ring-2 data-[focus-visible]:ring-accent-500 data-[focus-visible]:ring-offset-2",
            "data-[pressed]:scale-95",
            className,
          ),
        )}
      >
        {selectedEmoji}
      </AriaButton>
      <Popover placement="bottom start" className="overflow-hidden p-0">
        <Dialog className="outline-none">
          <div className="flex flex-col" style={{ width: GRID_WIDTH }}>
            <SearchField
              aria-label={t`Search emoji`}
              value={searchQuery}
              onChange={setSearchQuery}
              className="border-b border-accent-200 p-2 dark:border-accent-700"
            >
              <div className="relative">
                <Icon
                  name="#lucide/search"
                  className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-accent-500 dark:text-accent-400"
                />
                <Input
                  placeholder={t`Search emoji...`}
                  className={cn(
                    "flex h-9 w-full rounded-md border border-accent-300 bg-accent-50 py-2 pl-9 text-sm placeholder:text-accent-500 dark:border-accent-600 dark:bg-accent-800 dark:placeholder:text-accent-400",
                    "focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500 dark:focus:border-accent-400 dark:focus:ring-accent-400",
                    searchQuery ? "pr-9" : "pr-3",
                  )}
                />
                {searchQuery && (
                  <ClearButton
                    aria-label={t`Clear search`}
                    className="absolute right-2 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded-full text-accent-500 outline-none hover:bg-accent-200 hover:text-accent-700 dark:text-accent-400 dark:hover:bg-accent-700 dark:hover:text-accent-200"
                    slot={null}
                    onPress={() => setSearchQuery("")}
                  >
                    <Icon name="#lucide/x" className="size-3.5" />
                  </ClearButton>
                )}
              </div>
            </SearchField>
            {isSearching ? (
              <EmojiGrid emojis={filteredEmojis!} onSelect={handleSelect} />
            ) : (
              <CategorizedEmojiGrid onSelect={handleSelect} />
            )}
          </div>
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}

interface EmojiGridProps {
  emojis: Emoji[];
  onSelect: (emoji: string) => void;
}

function EmojiGrid({ emojis, onSelect }: EmojiGridProps) {
  const [parentRef, setParentRef] = useState<HTMLDivElement | null>(null);
  const rowCount = Math.ceil(emojis.length / GRID_COLUMNS);

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef,
    estimateSize: () => CELL_SIZE + GAP,
    overscan: 5,
  });

  if (emojis.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center text-sm text-accent-500 dark:text-accent-400">
        <Trans>No emoji found</Trans>
      </div>
    );
  }

  return (
    <div
      ref={setParentRef}
      className="h-[280px] overflow-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={{ contain: "strict", padding: GRID_PADDING }}
    >
      <ListBox
        aria-label={t`Emoji list`}
        selectionMode="single"
        onSelectionChange={(keys) => {
          const selectedKey = [...keys][0];
          if (typeof selectedKey === "string") {
            onSelect(selectedKey);
          }
        }}
        layout="grid"
        className="relative outline-none"
        style={{
          height: virtualizer.getTotalSize(),
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const startIndex = virtualRow.index * GRID_COLUMNS;
          const rowEmojis = emojis.slice(startIndex, startIndex + GRID_COLUMNS);

          return rowEmojis.map((emoji, columnIndex) => (
            <ListBoxItem
              key={emoji.unicode}
              id={emoji.unicode}
              textValue={
                (emoji.label || "") +
                (Array.isArray(emoji.tags) ? " " + emoji.tags.join(" ") : "")
              }
              className={cn(
                "absolute flex cursor-pointer items-center justify-center rounded-md text-2xl outline-none transition-colors",
                "data-[hovered]:bg-accent-100 dark:data-[hovered]:bg-accent-800",
                "data-[focused]:bg-accent-200 dark:data-[focused]:bg-accent-700",
                "data-[selected]:bg-accent-500 data-[selected]:text-white",
              )}
              style={{
                top: virtualRow.start,
                left: columnIndex * (CELL_SIZE + GAP),
                width: CELL_SIZE,
                height: CELL_SIZE,
              }}
            >
              {emoji.unicode}
            </ListBoxItem>
          ));
        })}
      </ListBox>
    </div>
  );
}

const HEADER_HEIGHT = 28;

type VirtualRow =
  | { type: "header"; group: number }
  | { type: "emojis"; emojis: Emoji[] };

// Build virtual rows: headers + emoji rows for each category
const virtualRows: VirtualRow[] = orderedGroups.flatMap((group) => {
  const categoryEmojis = groupedEmojis[group] || [];
  const emojiRows: VirtualRow[] = [];
  for (let i = 0; i < categoryEmojis.length; i += GRID_COLUMNS) {
    emojiRows.push({
      type: "emojis",
      emojis: categoryEmojis.slice(i, i + GRID_COLUMNS),
    });
  }
  return [{ type: "header", group } as VirtualRow, ...emojiRows];
});

interface CategorizedEmojiGridProps {
  onSelect: (emoji: string) => void;
}

function CategorizedEmojiGrid({ onSelect }: CategorizedEmojiGridProps) {
  const [parentRef, setParentRef] = useState<HTMLDivElement | null>(null);

  const virtualizer = useVirtualizer({
    count: virtualRows.length,
    getScrollElement: () => parentRef,
    estimateSize: (index) =>
      virtualRows[index].type === "header" ? HEADER_HEIGHT : CELL_SIZE + GAP,
    overscan: 5,
  });

  return (
    <div
      ref={setParentRef}
      className="h-[280px] overflow-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={{ contain: "strict", padding: GRID_PADDING }}
    >
      <div
        className="relative"
        style={{
          height: virtualizer.getTotalSize(),
        }}
      >
        {/* Render headers as regular divs */}
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const row = virtualRows[virtualItem.index];
          if (row.type !== "header") return null;

          return (
            <div
              key={`header-${row.group}`}
              className="absolute left-0 right-0 flex items-center text-xs font-medium capitalize text-accent-600 dark:text-accent-400"
              style={{
                top: virtualItem.start,
                height: HEADER_HEIGHT,
              }}
            >
              {GROUP_LABELS[row.group]}
            </div>
          );
        })}

        {/* Render emoji grid */}
        <ListBox
          aria-label={t`Emoji list`}
          selectionMode="single"
          onSelectionChange={(keys) => {
            const selectedKey = [...keys][0];
            if (typeof selectedKey === "string") {
              onSelect(selectedKey);
            }
          }}
          layout="grid"
          className="outline-none"
        >
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const row = virtualRows[virtualItem.index];
            if (row.type !== "emojis") return null;

            return row.emojis.map((emoji, columnIndex) => (
              <ListBoxItem
                key={emoji.unicode}
                id={emoji.unicode}
                textValue={
                  (emoji.label || "") +
                  (Array.isArray(emoji.tags) ? " " + emoji.tags.join(" ") : "")
                }
                className={cn(
                  "absolute flex cursor-pointer items-center justify-center rounded-md text-2xl outline-none transition-colors",
                  "data-[hovered]:bg-accent-100 dark:data-[hovered]:bg-accent-800",
                  "data-[focused]:bg-accent-200 dark:data-[focused]:bg-accent-700",
                  "data-[selected]:bg-accent-500 data-[selected]:text-white",
                )}
                style={{
                  top: virtualItem.start,
                  left: columnIndex * (CELL_SIZE + GAP),
                  width: CELL_SIZE,
                  height: CELL_SIZE,
                }}
              >
                {emoji.unicode}
              </ListBoxItem>
            ));
          })}
        </ListBox>
      </div>
    </div>
  );
}
