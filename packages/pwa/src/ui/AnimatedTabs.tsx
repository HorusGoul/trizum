import {
  Collection,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  type Key,
} from "react-aria-components";
import {
  animate,
  motion,
  useMotionValueEvent,
  useScroll,
  useTransform,
  type AnimationPlaybackControls,
} from "framer-motion";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { cn } from "./utils";
import { Icon, type IconProps } from "./Icon";

interface AnimatedTabsProps {
  tabs: {
    id: Key;
    label: string;
    node: React.ReactNode;
    icon: IconProps["name"];
    panelRef?: React.RefObject<HTMLDivElement | null>;
  }[];
  tabListClassName?: string;
  selectedTab: Key;
  onSelectedTabChange: (tab: Key) => void;
}

export function AnimatedTabs({
  tabs,
  tabListClassName,
  selectedTab,
  onSelectedTabChange,
}: AnimatedTabsProps) {
  const tabListRef = useRef<HTMLDivElement>(null);
  const tabPanelsRef = useRef<HTMLDivElement>(null);

  // Track the scroll position of the tab panel container.
  const { scrollXProgress } = useScroll({
    container: tabPanelsRef,
  });

  // Find all the tab elements so we can use their dimensions.
  const [tabElements, setTabElements] = useState<HTMLElement[]>([]);
  useEffect(() => {
    const tabList = tabListRef.current;

    if (tabElements.length === 0 && tabList) {
      const tabs = tabList.querySelectorAll<HTMLElement>("[role=tab]");
      setTabElements([...tabs]);
    }
  }, [tabElements]);

  // Initialize scroll position to match selectedTab on mount
  useLayoutEffect(() => {
    const tabPanel = tabPanelsRef.current;

    if (!tabPanel) {
      return;
    }

    const index = tabs.findIndex((tab) => tab.id === selectedTab);

    if (index >= 0) {
      tabPanel.scrollLeft = tabPanel.scrollWidth * (index / tabs.length);
    }
  }, []);

  // This function determines which tab should be selected
  // based on the scroll position.
  const getIndex = useCallback(
    (x: number) => Math.max(0, Math.floor((tabElements.length - 1) * x)),
    [tabElements],
  );

  // This function transforms the scroll position into the X position
  // or width of the selected tab indicator.
  const transform = (x: number, property: "offsetLeft" | "offsetWidth") => {
    if (!tabElements.length) return 0;

    // Find the tab index for the scroll X position.
    const index = getIndex(x);

    // Get the difference between this tab and the next one.
    const difference =
      index < tabElements.length - 1
        ? tabElements[index + 1][property] - tabElements[index][property]
        : tabElements[index].offsetWidth;

    // Get the percentage between tabs.
    // This is the difference between the integer index and fractional one.
    const percent = (tabElements.length - 1) * x - index;

    // Linearly interpolate to calculate the position of the selection indicator.
    const value = tabElements[index][property] + difference * percent;

    // iOS scrolls weird when translateX is 0 for some reason. 🤷‍♂️
    return value || 0.1;
  };

  const x = useTransform(scrollXProgress, (x) => transform(x, "offsetLeft"));
  const width = useTransform(scrollXProgress, (x) =>
    transform(x, "offsetWidth"),
  );

  // When the user scrolls, update the selected key
  // so that the correct tab panel becomes interactive.
  useMotionValueEvent(scrollXProgress, "change", (x) => {
    if (animationRef.current || !tabElements.length) return;
    onSelectedTabChange?.(tabs[getIndex(x)].id);
  });

  // When the user clicks on a tab perform an animation of
  // the scroll position to the newly selected tab panel.
  const animationRef = useRef<AnimationPlaybackControls>(null);
  const onSelectionChange = (selectedKey: Key) => {
    onSelectedTabChange?.(selectedKey);

    // If the scroll position is already moving but we aren't animating
    // then the key changed as a result of a user scrolling. Ignore.
    if (scrollXProgress.getVelocity() && !animationRef.current) {
      return;
    }

    const tabPanel = tabPanelsRef.current;
    const index = tabs.findIndex((tab) => tab.id === selectedKey);
    animationRef.current?.stop();

    if (!tabPanel) {
      return;
    }

    animationRef.current = animate(
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
          animationRef.current = null;
        },
      },
    );
  };

  return (
    <Tabs
      className="flex h-full flex-1 flex-col"
      selectedKey={selectedTab}
      onSelectionChange={onSelectionChange}
    >
      <div className="relative">
        <TabList
          ref={tabListRef}
          className={cn("flex w-full gap-2", tabListClassName)}
          items={tabs}
        >
          {(tab) => (
            <Tab className="flex flex-1 cursor-default touch-none items-center justify-center px-4 py-2.5 outline-none transition">
              {({ isSelected, isFocusVisible }) => (
                <>
                  <Icon name={tab.icon} size={20} className="mr-3" />
                  <span className="h-4.5 text-lg leading-none">
                    {tab.label}
                  </span>
                  {isFocusVisible && isSelected && (
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
          className="absolute -bottom-2 z-10 h-0.5 rounded-full bg-accent-500"
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
  );
}
