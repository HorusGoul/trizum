import { Suspense, use, useRef, useState, type CSSProperties } from "react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useLingui } from "@lingui/react";
import type { Emoji, MessagesDataset } from "emojibase";
import {
  Button as AriaButton,
  Dialog,
  DialogTrigger,
  Input,
  SearchField,
  Button as ClearButton,
  composeRenderProps,
} from "react-aria-components";
import { List, type ListImperativeAPI } from "react-window";
import { Popover } from "#src/ui/Popover.js";
import { cn } from "#src/ui/utils.js";
import { Icon } from "#src/ui/Icon.js";
import { DEFAULT_PARTY_SYMBOL } from "#src/models/party.ts";
import { DEFAULT_LOCALE, type SupportedLocale } from "#src/lib/i18n.js";
import { TrizumSpinner } from "./TrizumSpinner.js";

interface EmojiData {
  emojis: Emoji[];
  groupLabels: Record<number, string>;
  groupedEmojis: Record<number, Emoji[]>;
  orderedGroups: number[];
}

// Explicit imports for each supported locale
const emojiImports: Record<
  SupportedLocale,
  () => Promise<{ data: Emoji[]; messages: MessagesDataset }>
> = {
  en: async () => {
    const [data, messages] = await Promise.all([
      import("emojibase-data/en/data.json"),
      import("emojibase-data/en/messages.json"),
    ]);
    return { data: data.default, messages: messages.default };
  },
  es: async () => {
    const [data, messages] = await Promise.all([
      import("emojibase-data/es/data.json"),
      import("emojibase-data/es/messages.json"),
    ]);
    return { data: data.default, messages: messages.default };
  },
};

// Cache for loaded emoji data per locale
const emojiDataCache: Partial<Record<SupportedLocale, Promise<EmojiData>>> = {};

function loadEmojiData(locale: SupportedLocale): Promise<EmojiData> {
  const cached = emojiDataCache[locale];
  if (cached) {
    return cached;
  }

  const promise = (async () => {
    const { data: rawEmojis, messages } = await emojiImports[locale]();

    // Build group labels from messages
    const groupLabels: Record<number, string> = Object.fromEntries(
      messages.groups.map((g) => [g.order, g.message]),
    );

    // Filter out emojis without a group and component emojis (group 2)
    const emojis = rawEmojis.filter(
      (e) => e.version <= 15 && e.group !== undefined && e.group !== 2,
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
    const orderedGroups = messages.groups
      .filter((g) => g.order !== 2 && groupedEmojis[g.order]?.length > 0)
      .map((g) => g.order);

    return {
      emojis,
      groupLabels,
      groupedEmojis,
      orderedGroups,
    };
  })();

  emojiDataCache[locale] = promise;
  return promise;
}

function useEmojiData(): EmojiData {
  const { i18n } = useLingui();
  const locale = Object.keys(emojiImports).includes(i18n.locale)
    ? (i18n.locale as SupportedLocale)
    : DEFAULT_LOCALE;
  return use(loadEmojiData(locale));
}

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

  function handleSelect(emoji: string) {
    if (value === undefined) {
      setInternalValue(emoji);
    }
    onChange?.(emoji);
    setSearchQuery("");
    setIsOpen(false);
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
      <Popover placement="bottom end" className="overflow-hidden">
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
                  icon="lucide.search"
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
                    <Icon icon="lucide.x" className="size-3.5" />
                  </ClearButton>
                )}
              </div>
            </SearchField>
            <Suspense fallback={<EmojiGridSkeleton />}>
              <EmojiGridContent
                searchQuery={searchQuery}
                onSelect={handleSelect}
              />
            </Suspense>
          </div>
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}

function EmojiGridSkeleton() {
  return (
    <div className="flex h-[280px] items-center justify-center">
      <TrizumSpinner
        size={24}
        className="text-accent-600 dark:text-accent-400"
      />
    </div>
  );
}

interface EmojiGridContentProps {
  searchQuery: string;
  onSelect: (emoji: string) => void;
}

function EmojiGridContent({ searchQuery, onSelect }: EmojiGridContentProps) {
  const { emojis, groupLabels, groupedEmojis, orderedGroups } = useEmojiData();

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

  const isSearching = searchQuery.length > 0;

  if (isSearching) {
    return <EmojiGrid emojis={filteredEmojis!} onSelect={onSelect} />;
  }

  return (
    <CategorizedEmojiGrid
      groupLabels={groupLabels}
      groupedEmojis={groupedEmojis}
      orderedGroups={orderedGroups}
      onSelect={onSelect}
    />
  );
}

interface EmojiGridProps {
  emojis: Emoji[];
  onSelect: (emoji: string) => void;
}

function EmojiButton({
  emoji,
  onSelect,
}: {
  emoji: Emoji;
  onSelect: (emoji: string) => void;
}) {
  return (
    <button
      type="button"
      aria-label={emoji.label}
      title={emoji.label}
      onClick={() => onSelect(emoji.emoji)}
      className={cn(
        "flex size-9 cursor-pointer items-center justify-center rounded-md text-2xl outline-none transition-colors",
        "hover:bg-accent-100 dark:hover:bg-accent-800",
        "focus-visible:bg-accent-200 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-500 dark:focus-visible:bg-accent-700",
        "active:bg-accent-500 active:text-white",
      )}
    >
      {emoji.emoji}
    </button>
  );
}

interface EmojiGridRowProps {
  emojis: Emoji[];
  onSelect: (emoji: string) => void;
}

interface ListVisibleRows {
  startIndex: number;
  stopIndex: number;
}

interface ListRowAriaAttributes {
  "aria-posinset": number;
  "aria-setsize": number;
  role: "listitem";
}

interface ListRowBaseProps {
  ariaAttributes: ListRowAriaAttributes;
  index: number;
  style: CSSProperties;
}

function EmojiGridRow({
  ariaAttributes,
  emojis,
  index,
  onSelect,
  style,
}: ListRowBaseProps & EmojiGridRowProps) {
  const startIndex = index * GRID_COLUMNS;
  const rowEmojis = emojis.slice(startIndex, startIndex + GRID_COLUMNS);

  return (
    <div
      {...ariaAttributes}
      style={{
        ...style,
        boxSizing: "border-box",
        paddingInline: GRID_PADDING,
      }}
      className="flex items-start"
    >
      <div
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${GRID_COLUMNS}, ${CELL_SIZE}px)`,
          columnGap: GAP,
        }}
      >
        {rowEmojis.map((emoji) => (
          <EmojiButton key={emoji.emoji} emoji={emoji} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}

function EmojiGrid({ emojis, onSelect }: EmojiGridProps) {
  const rowCount = Math.ceil(emojis.length / GRID_COLUMNS);

  if (emojis.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center text-sm text-accent-500 dark:text-accent-400">
        <Trans>No emoji found</Trans>
      </div>
    );
  }

  return (
    <List<EmojiGridRowProps>
      aria-label={t`Emoji list`}
      className="h-[280px] overflow-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      overscanCount={5}
      rowComponent={EmojiGridRow}
      rowCount={rowCount}
      rowHeight={CELL_SIZE + GAP}
      rowProps={{ emojis, onSelect }}
      style={{
        contain: "strict",
        height: 280,
        width: GRID_WIDTH,
      }}
    />
  );
}

const HEADER_HEIGHT = 28;
const CATEGORY_TAB_HEIGHT = 36;

// Representative emoji icons for each category
const CATEGORY_ICONS: Record<number, string> = {
  0: "😀", // Smileys & Emotion
  1: "👋", // People & Body
  3: "🐻", // Animals & Nature
  4: "🍔", // Food & Drink
  5: "✈️", // Travel & Places
  6: "⚽", // Activities
  7: "💡", // Objects
  8: "💕", // Symbols
  9: "🏳️", // Flags
};

type VirtualRow =
  | { type: "header"; group: number }
  | { type: "emojis"; emojis: Emoji[] };

interface VirtualRowsResult {
  rows: VirtualRow[];
  groupStartIndices: Map<number, number>;
}

function buildVirtualRows(
  orderedGroups: number[],
  groupedEmojis: Record<number, Emoji[]>,
): VirtualRowsResult {
  const rows: VirtualRow[] = [];
  const groupStartIndices = new Map<number, number>();

  for (const group of orderedGroups) {
    groupStartIndices.set(group, rows.length);
    rows.push({ type: "header", group });

    const categoryEmojis = groupedEmojis[group] || [];
    for (let i = 0; i < categoryEmojis.length; i += GRID_COLUMNS) {
      rows.push({
        type: "emojis",
        emojis: categoryEmojis.slice(i, i + GRID_COLUMNS),
      });
    }
  }

  return { rows, groupStartIndices };
}

function getGroupForRowIndex(
  rows: VirtualRow[],
  orderedGroups: number[],
  rowIndex: number,
) {
  const fallbackGroup = orderedGroups[0] ?? 0;
  const boundedIndex = Math.min(rowIndex, rows.length - 1);

  for (let index = boundedIndex; index >= 0; index -= 1) {
    const row = rows[index];
    if (row.type === "header") {
      return row.group;
    }
  }

  return fallbackGroup;
}

interface CategorizedEmojiRowProps {
  groupLabels: Record<number, string>;
  onSelect: (emoji: string) => void;
  rows: VirtualRow[];
}

function CategorizedEmojiRow({
  ariaAttributes,
  groupLabels,
  index,
  onSelect,
  rows,
  style,
}: ListRowBaseProps & CategorizedEmojiRowProps) {
  const row = rows[index];

  if (row.type === "header") {
    return (
      <div
        {...ariaAttributes}
        style={{
          ...style,
          boxSizing: "border-box",
          paddingInline: GRID_PADDING,
        }}
        className="flex items-center text-xs font-medium capitalize text-accent-600 dark:text-accent-400"
      >
        {groupLabels[row.group]}
      </div>
    );
  }

  return (
    <div
      {...ariaAttributes}
      style={{
        ...style,
        boxSizing: "border-box",
        paddingInline: GRID_PADDING,
      }}
      className="flex items-start"
    >
      <div
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${GRID_COLUMNS}, ${CELL_SIZE}px)`,
          columnGap: GAP,
        }}
      >
        {row.emojis.map((emoji) => (
          <EmojiButton key={emoji.emoji} emoji={emoji} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}

interface CategorizedEmojiGridProps {
  groupLabels: Record<number, string>;
  groupedEmojis: Record<number, Emoji[]>;
  orderedGroups: number[];
  onSelect: (emoji: string) => void;
}

function CategorizedEmojiGrid({
  groupLabels,
  groupedEmojis,
  orderedGroups,
  onSelect,
}: CategorizedEmojiGridProps) {
  const firstGroup = orderedGroups[0] ?? 0;
  const [activeGroup, setActiveGroup] = useState(firstGroup);
  const { rows: virtualRows, groupStartIndices } = buildVirtualRows(
    orderedGroups,
    groupedEmojis,
  );
  const listRef = useRef<ListImperativeAPI | null>(null);

  function scrollToGroup(group: number) {
    const rowIndex = groupStartIndices.get(group);
    if (rowIndex !== undefined) {
      listRef.current?.scrollToRow({ align: "start", index: rowIndex });
    }
  }

  return (
    <div className="flex flex-col">
      {/* Category tabs */}
      <div
        className="flex justify-between border-b border-accent-200 px-1 dark:border-accent-700"
        style={{ height: CATEGORY_TAB_HEIGHT }}
      >
        {orderedGroups.map((group) => (
          <button
            key={group}
            type="button"
            onClick={() => scrollToGroup(group)}
            aria-label={groupLabels[group]}
            title={groupLabels[group]}
            className={cn(
              "flex flex-1 items-center justify-center text-lg transition-colors",
              "hover:bg-accent-100 dark:hover:bg-accent-800",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-500",
              activeGroup === group && "bg-accent-100 dark:bg-accent-800",
            )}
          >
            {CATEGORY_ICONS[group] || "📁"}
          </button>
        ))}
      </div>

      <List<CategorizedEmojiRowProps>
        aria-label={t`Emoji list`}
        className="h-[244px] overflow-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        listRef={listRef}
        onRowsRendered={(visibleRows: ListVisibleRows) => {
          const currentGroup = getGroupForRowIndex(
            virtualRows,
            orderedGroups,
            visibleRows.startIndex,
          );

          setActiveGroup((previousGroup) =>
            previousGroup === currentGroup ? previousGroup : currentGroup,
          );
        }}
        overscanCount={5}
        rowComponent={CategorizedEmojiRow}
        rowCount={virtualRows.length}
        rowHeight={(index: number) =>
          virtualRows[index].type === "header" ? HEADER_HEIGHT : CELL_SIZE + GAP
        }
        rowProps={{ groupLabels, onSelect, rows: virtualRows }}
        style={{
          contain: "strict",
          height: 244,
          width: GRID_WIDTH,
        }}
      />
    </div>
  );
}
