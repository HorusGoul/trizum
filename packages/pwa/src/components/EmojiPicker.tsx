import { Suspense, use, useState } from "react";
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
import { List, useListRef, type RowComponentProps } from "react-window";
import { Popover } from "@trizum/ui/Popover";
import { cn } from "@trizum/ui/utils";
import { Icon } from "@trizum/ui/Icon";
import { DEFAULT_PARTY_SYMBOL } from "#src/models/party.ts";
import { DEFAULT_LOCALE, type SupportedLocale } from "#src/lib/locales.js";
import { TrizumSpinner } from "@trizum/ui/TrizumSpinner";

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
    const groupedEmojis = emojis.reduce<Record<number, Emoji[]>>((acc, emoji) => {
      const group = emoji.group ?? 0;

      if (!acc[group]) {
        acc[group] = [];
      }

      acc[group].push(emoji);

      return acc;
    }, {});

    // Get ordered list of groups that have emojis
    const orderedGroups: number[] = [];

    for (const group of messages.groups) {
      if (group.order !== 2 && groupedEmojis[group.order]?.length > 0) {
        orderedGroups.push(group.order);
      }
    }

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

  // SAFETY: The locale was found among emojiImports keys immediately above.
  const locale = Object.keys(emojiImports).includes(i18n.locale)
    ? (i18n.locale as SupportedLocale)
    : DEFAULT_LOCALE;

  return use(loadEmojiData(locale));
}

const GRID_COLUMNS = 8;
const CELL_SIZE = 36;
const GAP = 4;
const GRID_PADDING = 8;
const GRID_WIDTH = GRID_COLUMNS * CELL_SIZE + (GRID_COLUMNS - 1) * GAP + GRID_PADDING * 2;

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
            "flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-2xl shadow-surface inset-ring inset-ring-neutral-950/5 transition-all dark:bg-white/10 dark:inset-ring-0",
            "data-[hovered]:bg-neutral-50 dark:data-[hovered]:bg-white/15",
            "data-[focus-visible]:outline-hidden data-[focus-visible]:ring-2 data-[focus-visible]:ring-accent-500 dark:data-[focus-visible]:ring-accent-400",
            "data-[pressed]:scale-95",
            className,
          ),
        )}
      >
        {selectedEmoji}
      </AriaButton>
      <Popover placement="bottom end" className="overflow-hidden">
        <Dialog className="outline-hidden">
          <div className="flex flex-col" style={{ width: GRID_WIDTH }}>
            <SearchField
              aria-label={t`Search emoji`}
              value={searchQuery}
              onChange={setSearchQuery}
              className="p-2"
            >
              <div className="relative">
                <Icon
                  icon="lucide.search"
                  className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-neutral-400 dark:text-neutral-500"
                />
                <Input
                  placeholder={t`Search emoji...`}
                  className={cn(
                    "flex h-9 w-full rounded-2xl bg-neutral-100 py-2 pl-9 text-sm placeholder:text-neutral-400 dark:bg-neutral-700 dark:placeholder:text-neutral-500",
                    "focus:outline-hidden focus:ring-2 focus:ring-accent-500 dark:focus:ring-accent-400",
                    searchQuery ? "pr-9" : "pr-3",
                  )}
                />
                {searchQuery && (
                  <ClearButton
                    aria-label={t`Clear search`}
                    className="absolute top-1/2 right-2 flex size-5 -translate-y-1/2 items-center justify-center rounded-full text-neutral-500 outline-hidden hover:bg-neutral-950/10 hover:text-neutral-950 dark:text-neutral-400 dark:hover:bg-white/15 dark:hover:text-neutral-50"
                    slot={null}
                    onPress={() => setSearchQuery("")}
                  >
                    <Icon icon="lucide.x" className="size-3.5" />
                  </ClearButton>
                )}
              </div>
            </SearchField>
            <Suspense fallback={<EmojiGridSkeleton />}>
              <EmojiGridContent searchQuery={searchQuery} onSelect={handleSelect} />
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
      <TrizumSpinner size={24} className="text-neutral-600 dark:text-neutral-400" />
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
          Array.isArray(emoji.tags) && emoji.tags.some((tag) => tag.toLowerCase().includes(query));

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

function EmojiButton({ emoji, onSelect }: { emoji: Emoji; onSelect: (emoji: string) => void }) {
  return (
    <button
      type="button"
      aria-label={emoji.label}
      title={emoji.label}
      onClick={() => onSelect(emoji.emoji)}
      className={cn(
        "flex size-9 cursor-pointer items-center justify-center rounded-xl text-2xl outline-hidden transition-colors",
        "hover:bg-neutral-950/5 dark:hover:bg-white/10",
        "focus-visible:bg-neutral-950/5 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-500 dark:focus-visible:bg-white/10 dark:focus-visible:ring-accent-400",
        "active:bg-neutral-950/10 dark:active:bg-white/15",
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

function EmojiGridRow({
  ariaAttributes,
  emojis,
  index,
  onSelect,
  style,
}: RowComponentProps<EmojiGridRowProps>) {
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
      <div className="flex h-[200px] items-center justify-center text-sm text-neutral-500 dark:text-neutral-400">
        <Trans>No emoji found</Trans>
      </div>
    );
  }

  return (
    <List
      aria-label={t`Emoji list`}
      className="h-[280px] [scrollbar-width:none] overflow-auto [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
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
const CATEGORY_ICONS = {
  0: "😀", // Smileys & Emotion
  1: "👋", // People & Body
  3: "🐻", // Animals & Nature
  4: "🍔", // Food & Drink
  5: "✈️", // Travel & Places
  6: "⚽", // Activities
  7: "💡", // Objects
  8: "💕", // Symbols
  9: "🏳️", // Flags
} satisfies Record<number, string>;

function hasCategoryIcon(group: number): group is keyof typeof CATEGORY_ICONS {
  return Object.hasOwn(CATEGORY_ICONS, group);
}

type VirtualRow = { type: "header"; group: number } | { type: "emojis"; emojis: Emoji[] };

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

function getGroupForRowIndex(rows: VirtualRow[], orderedGroups: number[], rowIndex: number) {
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
}: RowComponentProps<CategorizedEmojiRowProps>) {
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
        className="flex items-center text-xs font-medium text-neutral-600 capitalize dark:text-neutral-400"
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
  const { rows: virtualRows, groupStartIndices } = buildVirtualRows(orderedGroups, groupedEmojis);
  const listRef = useListRef(null);

  function scrollToGroup(group: number) {
    const rowIndex = groupStartIndices.get(group);

    if (rowIndex !== undefined) {
      listRef.current?.scrollToRow({ align: "start", index: rowIndex });
    }
  }

  return (
    <div className="flex flex-col">
      {/* Category tabs */}
      <div className="flex justify-between gap-0.5 px-2" style={{ height: CATEGORY_TAB_HEIGHT }}>
        {orderedGroups.map((group) => (
          <button
            key={group}
            type="button"
            onClick={() => scrollToGroup(group)}
            aria-label={groupLabels[group]}
            title={groupLabels[group]}
            className={cn(
              "flex flex-1 items-center justify-center rounded-xl text-lg transition-colors",
              "hover:bg-neutral-950/5 dark:hover:bg-white/10",
              "focus:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-500 dark:focus-visible:ring-accent-400",
              activeGroup === group && "bg-neutral-950/10 dark:bg-white/15",
            )}
          >
            {hasCategoryIcon(group) ? CATEGORY_ICONS[group] : "📁"}
          </button>
        ))}
      </div>

      <List
        aria-label={t`Emoji list`}
        className="h-[244px] [scrollbar-width:none] overflow-auto [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        listRef={listRef}
        onRowsRendered={(visibleRows) => {
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
        rowHeight={(index) =>
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
