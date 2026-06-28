import { Collection, Tab, TabList, TabPanel, Tabs, type Key } from "react-aria-components";
import {
  LazyMotion,
  animate,
  domAnimation,
  m as motion,
  useMotionValue,
  useMotionValueEvent,
  useScroll,
  type AnimationPlaybackControls,
} from "motion/react";
import { useLayoutEffect, useOptimistic, useRef } from "react";
import { cn } from "./utils";
import { Icon, type IconProps } from "./Icon";
import { useActionProp, type AsyncAction } from "./useActionProp";

const activeTabPanelAnimations = new WeakMap<HTMLDivElement, AnimationPlaybackControls>();
type IndicatorProperty = "offsetLeft" | "offsetWidth";

interface AnimatedTabsProps {
  tabs: {
    id: Key;
    label: string;
    node: React.ReactNode;
    icon: IconProps["icon"];
    panelRef?: React.RefObject<HTMLDivElement | null>;
  }[];
  tabListClassName?: string;
  selectedTab: Key;
  onSelectedTabChange?: (tab: Key) => void;
  selectionChangeAction?: AsyncAction<[Key]>;
}

function getIndex(tabCount: number, scrollProgress: number) {
  return Math.max(0, Math.floor((tabCount - 1) * scrollProgress));
}

function getIndicatorValue(
  tabElements: HTMLElement[],
  scrollProgress: number,
  property: IndicatorProperty,
) {
  if (!tabElements.length) {
    return 0;
  }

  const index = getIndex(tabElements.length, scrollProgress);
  const currentTab = tabElements[index];
  const nextTab = tabElements[index + 1];
  const difference = nextTab ? nextTab[property] - currentTab[property] : currentTab.offsetWidth;
  const percent = (tabElements.length - 1) * scrollProgress - index;
  const value = currentTab[property] + difference * percent;

  // iOS scrolls weird when translateX is 0 for some reason.
  return value || 0.1;
}

function getSelectedProgress(tabs: AnimatedTabsProps["tabs"], selectedTab: Key) {
  const selectedIndex = tabs.findIndex((tab) => tab.id === selectedTab);

  return selectedIndex >= 0 && tabs.length > 1 ? selectedIndex / (tabs.length - 1) : 0;
}

export function AnimatedTabs({
  tabs,
  tabListClassName,
  selectedTab,
  onSelectedTabChange,
  selectionChangeAction,
}: AnimatedTabsProps) {
  const tabListRef = useRef<HTMLDivElement>(null);
  const tabPanelsRef = useRef<HTMLDivElement>(null);
  const [optimisticSelectedTab, setOptimisticSelectedTab] = useOptimistic(selectedTab);
  const [isSelectionPending, runSelectionChangeAction] = useActionProp<[Key]>({
    action: selectionChangeAction
      ? (tab) => {
          setOptimisticSelectedTab(tab);
          return selectionChangeAction(tab);
        }
      : undefined,
    onAction: onSelectedTabChange,
  });

  // Track the scroll position of the tab panel container.
  const { scrollXProgress } = useScroll({
    container: tabPanelsRef,
  });

  // Find all the tab elements so we can use their dimensions.
  const tabElementsRef = useRef<HTMLElement[]>([]);
  const x = useMotionValue(0.1);
  const width = useMotionValue(0);

  useLayoutEffect(() => {
    const tabList = tabListRef.current;

    if (!tabList) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      const tabElements = Array.from(tabList.querySelectorAll<HTMLElement>("[role=tab]"));
      const selectedProgress = getSelectedProgress(tabs, optimisticSelectedTab);

      tabElementsRef.current = tabElements;
      x.set(getIndicatorValue(tabElements, selectedProgress, "offsetLeft"));
      width.set(getIndicatorValue(tabElements, selectedProgress, "offsetWidth"));
    });

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [optimisticSelectedTab, tabs, x, width]);

  const initialSelectedTab = useRef(optimisticSelectedTab);
  const initialTabs = useRef(tabs);

  function runSelectionChange(tab: Key) {
    if (tab === optimisticSelectedTab) {
      return;
    }

    runSelectionChangeAction?.(tab);
  }

  // Initialize scroll position to match selectedTab on mount
  useLayoutEffect(() => {
    const tabPanel = tabPanelsRef.current;

    if (!tabPanel) {
      return;
    }

    const index = initialTabs.current.findIndex((tab) => tab.id === initialSelectedTab.current);

    if (index >= 0) {
      tabPanel.scrollLeft = tabPanel.scrollWidth * (index / initialTabs.current.length);
    }
  }, []);

  // When the user scrolls, update the selected key
  // so that the correct tab panel becomes interactive.
  useMotionValueEvent(scrollXProgress, "change", (scrollProgress) => {
    const tabElements = tabElementsRef.current;

    x.set(getIndicatorValue(tabElements, scrollProgress, "offsetLeft"));
    width.set(getIndicatorValue(tabElements, scrollProgress, "offsetWidth"));

    const tabPanel = tabPanelsRef.current;

    if (!tabPanel || activeTabPanelAnimations.has(tabPanel) || !tabElements.length) {
      return;
    }

    const nextTab = tabs[getIndex(tabElements.length, scrollProgress)];

    if (nextTab) {
      runSelectionChange(nextTab.id);
    }
  });

  // When the user clicks on a tab perform an animation of
  // the scroll position to the newly selected tab panel.
  const onSelectionChange = (selectedKey: Key) => {
    runSelectionChange(selectedKey);
    const tabPanel = tabPanelsRef.current;
    const existingAnimation = tabPanel ? activeTabPanelAnimations.get(tabPanel) : null;

    // If the scroll position is already moving but we aren't animating
    // then the key changed as a result of a user scrolling. Ignore.
    if (scrollXProgress.getVelocity() && !existingAnimation) {
      return;
    }

    const index = tabs.findIndex((tab) => tab.id === selectedKey);
    existingAnimation?.stop();

    if (!tabPanel) {
      return;
    }

    const nextAnimation = animate(
      tabPanel.scrollLeft,
      tabPanel.scrollWidth * (index / tabs.length),
      {
        type: "spring",
        bounce: 0.2,
        duration: 0.6,
        onUpdate: (v) => {
          tabPanel.scrollLeft = v;
        },
        onPlay: () => {
          // Disable scroll snap while the animation is going or weird things happen.
          tabPanel.style.scrollSnapType = "none";
        },
        onComplete: () => {
          tabPanel.style.scrollSnapType = "";
          activeTabPanelAnimations.delete(tabPanel);
        },
      },
    );
    activeTabPanelAnimations.set(tabPanel, nextAnimation);
  };

  return (
    <LazyMotion features={domAnimation}>
      <Tabs
        className="flex h-full flex-1 flex-col"
        data-pending={isSelectionPending || undefined}
        selectedKey={optimisticSelectedTab}
        onSelectionChange={onSelectionChange}
      >
        <div className="relative">
          <TabList
            ref={tabListRef}
            className={cn("flex w-full gap-2", tabListClassName)}
            items={tabs}
          >
            {(tab) => (
              <Tab className="flex flex-1 cursor-pointer touch-none select-none items-center justify-center px-4 py-2.5 outline-none transition">
                {({ isSelected, isFocusVisible }) => (
                  <>
                    <Icon icon={tab.icon} width={20} height={20} className="mr-3" />
                    <span className="h-4.5 text-lg leading-none">{tab.label}</span>
                    {isFocusVisible &&
                      isSelected && (
                        // Focus ring.
                        <motion.span
                          className="absolute inset-0 z-10 rounded-full ring-2 ring-black ring-offset-2"
                          style={{ x, width }}
                        />
                      )}
                  </>
                )}
              </Tab>
            )}
          </TabList>
          {/* Selection indicator. */}
          <motion.span
            className={cn(
              "absolute -bottom-2 z-10 h-0.5 rounded-full bg-accent-500",
              isSelectionPending && "animate-pulse",
            )}
            style={{ x, width }}
          />
        </div>
        <div
          ref={tabPanelsRef}
          className="no-scrollbar mt-2.5 flex h-full flex-1 snap-x snap-mandatory overflow-x-auto"
        >
          <Collection items={tabs}>
            {(tab) => (
              <TabPanel
                shouldForceMount
                className="no-scrollbar box-border flex w-full flex-shrink-0 snap-start flex-col overflow-y-auto rounded outline-none -outline-offset-2 focus-visible:outline-black"
                ref={tab.panelRef}
              >
                {tab.node}
              </TabPanel>
            )}
          </Collection>
        </div>
      </Tabs>
    </LazyMotion>
  );
}
