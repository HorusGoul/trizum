import { Sheet, type SheetRef } from "react-modal-sheet";
import { useRef, type ReactNode, forwardRef, useImperativeHandle } from "react";
import {
  useOverlayTriggerState,
  type OverlayTriggerState,
} from "react-stately";
import {
  useOverlay,
  useModal,
  OverlayProvider,
  FocusScope,
  useDialog,
} from "react-aria";
import { cn } from "./utils";
import { IconWithFallback, type IconProps } from "./Icon";
import { Link, type LinkProps } from "react-aria-components";

export interface BottomSheetRef {
  open: () => void;
  close: () => void;
  isOpen: boolean;
}

export interface BottomSheetProps {
  trigger: (props: { onOpen: () => void }) => ReactNode;
  children: ReactNode;
  ariaLabel?: string;
}

export const BottomSheet = forwardRef<BottomSheetRef, BottomSheetProps>(
  function BottomSheet({ trigger, children, ariaLabel }, ref) {
    const sheetState = useOverlayTriggerState({});

    useImperativeHandle(ref, () => ({
      open: sheetState.open,
      close: sheetState.close,
      isOpen: sheetState.isOpen,
    }));

    return (
      <>
        {trigger({ onOpen: sheetState.open })}

        <Sheet
          isOpen={sheetState.isOpen}
          onClose={sheetState.close}
          detent="content"
          unstyled
        >
          <OverlayProvider>
            <FocusScope contain autoFocus restoreFocus>
              <SheetContent sheetState={sheetState} ariaLabel={ariaLabel}>
                {children}
              </SheetContent>
            </FocusScope>
          </OverlayProvider>
        </Sheet>
      </>
    );
  },
);

interface SheetContentProps {
  sheetState: OverlayTriggerState;
  children: ReactNode;
  ariaLabel?: string;
}

function SheetContent({ sheetState, children, ariaLabel }: SheetContentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<SheetRef>(null);
  const dialog = useDialog({ "aria-label": ariaLabel }, containerRef);
  const overlay = useOverlay(
    { onClose: sheetState.close, isOpen: true, isDismissable: true },
    containerRef,
  );

  useModal();

  return (
    <>
      <Sheet.Container
        ref={sheetRef}
        className="mx-auto max-w-md rounded-t-2xl border-t border-accent-700 bg-accent-900 shadow-xl shadow-black/40"
        style={{ left: 0, right: 0 }}
      >
        <Sheet.Header className="flex cursor-grab justify-center pb-1 pt-3 active:cursor-grabbing">
          <div className="h-1.5 w-12 rounded-full bg-accent-500" />
        </Sheet.Header>
        <Sheet.Content disableDrag>
          <div
            {...overlay.overlayProps}
            {...dialog.dialogProps}
            ref={containerRef}
            className="flex flex-col pb-safe-offset-4"
          >
            {children}
          </div>
        </Sheet.Content>
      </Sheet.Container>
      <Sheet.Backdrop
        className="fixed inset-0 bg-black/60"
        onTap={sheetState.close}
      />
    </>
  );
}

export interface BottomSheetItemProps {
  icon: IconProps["name"];
  children: ReactNode;
  onAction?: () => void;
  href?: LinkProps["href"];
}

export function BottomSheetItem({
  icon,
  children,
  onAction,
  href,
}: BottomSheetItemProps) {
  const baseClassName = cn(
    "flex items-center px-5 py-4 outline-none transition-all",
    "bg-accent-50 bg-opacity-0 dark:bg-accent-50 dark:bg-opacity-0",
    "pressed:bg-opacity-10 dark:pressed:bg-opacity-10",
    "focus-visible:bg-opacity-5 dark:focus-visible:bg-opacity-5",
    "hover:bg-opacity-5 dark:hover:bg-opacity-5",
  );

  const content = (
    <>
      <IconWithFallback name={icon} size={22} className="mr-4" />
      <span className="text-lg leading-none">{children}</span>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={baseClassName}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onAction} className={baseClassName}>
      {content}
    </button>
  );
}
