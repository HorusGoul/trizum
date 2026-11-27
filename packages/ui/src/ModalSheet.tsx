import {
  DismissButton,
  FocusScope,
  mergeProps,
  OverlayProvider,
  useDialog,
  useModal,
  useOverlay,
} from "react-aria";
import {
  Button as AriaButton,
  composeRenderProps,
  Heading,
  type ButtonProps as AriaButtonProps,
  type ButtonRenderProps,
  type HeadingProps,
} from "react-aria-components";
import { Sheet, type SheetProps } from "react-modal-sheet";
import {
  createContext,
  type ComponentProps,
  type ComponentPropsWithoutRef,
  type ReactNode,
  use,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { sheetTweenConfig } from "./sheetMotion.js";
import { SheetSurface } from "./SheetSurface.js";
import { Icon, type IconProps } from "./Icon.js";
import { Checkbox } from "./Checkbox.js";
import { ModalSheetNavigationContext } from "./modalSheetNavigation.js";
import { cn, type ClassName } from "./utils.js";

interface ModalSheetContextValue {
  descriptionId: string;
  setHasDescription: (hasDescription: boolean) => void;
  setHasTitle: (hasTitle: boolean) => void;
  titleId: string;
}

const ModalSheetContext = createContext<ModalSheetContextValue | null>(null);

interface ModalSheetProps extends Omit<
  SheetProps,
  "children" | "className" | "isOpen" | "onClose" | "onContextMenu" | "unstyled"
> {
  "aria-label"?: string;
  children: ReactNode;
  className?: ClassName;
  isDismissable?: boolean;
  isOpen: boolean;
  onContextMenu?: ComponentPropsWithoutRef<"div">["onContextMenu"];
  onOpenChange?: (isOpen: boolean) => void;
  overlayClassName?: ClassName;
}

export function ModalSheet({
  "aria-label": ariaLabel,
  children,
  className,
  detent = "content",
  disableDismiss,
  isDismissable = true,
  isOpen,
  onContextMenu,
  onOpenChange,
  overlayClassName,
  ...props
}: ModalSheetProps) {
  const close = () => {
    onOpenChange?.(false);
  };

  return (
    <>
      <SheetBackNavigation
        isOpen={isOpen}
        isDismissable={isDismissable}
        onOpenChange={onOpenChange}
      />
      <Sheet
        disableDismiss={disableDismiss ?? !isDismissable}
        detent={detent}
        isOpen={isOpen}
        onClose={close}
        style={{ zIndex: 50 }}
        unstyled
        tweenConfig={sheetTweenConfig}
        {...props}
      >
        <OverlayProvider>
          <FocusScope contain restoreFocus>
            <AccessibleSheetContainer
              ariaLabel={ariaLabel}
              className={className}
              close={close}
              isDismissable={isDismissable}
              isOpen={isOpen}
            >
              {children}
            </AccessibleSheetContainer>
          </FocusScope>

          <Sheet.Backdrop
            className={cn("bg-black/40 backdrop-blur-[2px] dark:bg-black/60", overlayClassName)}
            onContextMenu={(event) => {
              onContextMenu?.(event);
              event.preventDefault();
            }}
            onTap={isDismissable ? close : undefined}
          />
        </OverlayProvider>
      </Sheet>
    </>
  );
}

// This sibling registers before the portal subtree, including initially open nested sheets.
function SheetBackNavigation({
  isOpen,
  isDismissable,
  onOpenChange,
}: Pick<ModalSheetProps, "isOpen" | "onOpenChange"> & { isDismissable: boolean }) {
  const navigation = use(ModalSheetNavigationContext);
  const current = useRef({ isDismissable, onOpenChange });

  useEffect(() => {
    current.current = { isDismissable, onOpenChange };
  }, [isDismissable, onOpenChange]);

  useEffect(() => {
    if (!isOpen || !navigation) return;

    return navigation.register(() => {
      if (!current.current.isDismissable || !current.current.onOpenChange) return false;
      current.current.onOpenChange(false);

      return true;
    });
  }, [isOpen, navigation]);

  return null;
}

function AccessibleSheetContainer({
  ariaLabel,
  children,
  className,
  close,
  isDismissable,
  isOpen,
}: {
  ariaLabel?: string;
  children: ReactNode;
  className?: ClassName;
  close: () => void;
  isDismissable: boolean;
  isOpen: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [hasDescription, setHasDescription] = useState(false);
  const [hasTitle, setHasTitle] = useState(false);

  const [contextValue] = useState<ModalSheetContextValue>(() => ({
    descriptionId,
    setHasDescription,
    setHasTitle,
    titleId,
  }));

  const { overlayProps } = useOverlay(
    {
      isDismissable,
      isKeyboardDismissDisabled: !isDismissable,
      isOpen,
      onClose: close,
    },
    containerRef,
  );

  const { modalProps } = useModal();
  const { dialogProps } = useDialog({ "aria-label": ariaLabel }, containerRef);

  return (
    <ModalSheetContext value={contextValue}>
      <Sheet.Container className={cn("right-0 mx-auto mt-12 w-full max-w-xl sm:mt-0", className)}>
        <SheetSurface>
          <div
            {...mergeProps(overlayProps, modalProps, dialogProps)}
            ref={containerRef}
            aria-describedby={hasDescription ? descriptionId : undefined}
            aria-labelledby={hasTitle ? titleId : undefined}
            className="flex min-h-0 flex-1 flex-col outline-hidden"
          >
            {isDismissable ? <DismissButton onDismiss={close} /> : null}
            {children}
            {isDismissable ? <DismissButton onDismiss={close} /> : null}
          </div>
        </SheetSurface>
      </Sheet.Container>
    </ModalSheetContext>
  );
}

export function ModalSheetHeader({
  className,
  children,
  hideDragIndicator = false,
}: {
  className?: ClassName;
  children?: ReactNode;
  hideDragIndicator?: boolean;
}) {
  return (
    <Sheet.Header className={cn("pb-2 pt-3 px-safe", className)}>
      <div data-modal-sheet-drag-handle="" className="flex flex-col gap-3">
        {hideDragIndicator ? null : (
          <div className="flex justify-center">
            <span
              aria-hidden="true"
              className="h-1.5 w-10 rounded-full bg-neutral-950/15 dark:bg-white/20"
            />
          </div>
        )}

        {children}
      </div>
    </Sheet.Header>
  );
}

export function ModalSheetTitle({ className, ...props }: HeadingProps) {
  const context = useModalSheetContext();

  useEffect(() => {
    context.setHasTitle(true);

    return () => {
      context.setHasTitle(false);
    };
  }, [context]);

  return (
    <Heading
      id={context.titleId}
      slot="title"
      className={cn(
        "text-base font-semibold tracking-tight text-neutral-950 dark:text-neutral-50",
        className,
      )}
      {...props}
    />
  );
}

export function ModalSheetDescription({ className, ...props }: ComponentPropsWithoutRef<"p">) {
  const context = useModalSheetContext();

  useEffect(() => {
    context.setHasDescription(true);

    return () => {
      context.setHasDescription(false);
    };
  }, [context]);

  return (
    <p
      id={context.descriptionId}
      className={cn("text-sm text-neutral-600 dark:text-neutral-400", className)}
      {...props}
    />
  );
}

export function ModalSheetContent({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return (
    <Sheet.Content className="min-h-0">
      <div
        className={cn("min-h-0 overflow-y-auto px-safe pb-safe-offset-4", className)}
        {...props}
      />
    </Sheet.Content>
  );
}

export type ModalSheetActionTone = "default" | "danger";

function sheetRowFeedback(
  state: Pick<ButtonRenderProps, "isHovered" | "isFocusVisible" | "isPressed">,
  tone: ModalSheetActionTone,
) {
  return cn(
    "outline-hidden transition-[scale,background-color,box-shadow] duration-200 ease-in-out motion-reduce:scale-100 motion-reduce:transition-none",
    tone === "danger"
      ? "text-rose-700 dark:text-rose-300"
      : "text-neutral-950 dark:text-neutral-50",
    state.isHovered &&
      (tone === "danger"
        ? "bg-rose-500/10 dark:bg-rose-400/10"
        : "bg-neutral-950/5 dark:bg-white/10"),
    state.isFocusVisible &&
      (tone === "danger"
        ? "bg-rose-500/10 ring-2 ring-rose-500 dark:bg-rose-400/10 dark:ring-rose-400"
        : "bg-neutral-950/5 ring-2 ring-accent-500 dark:bg-white/10 dark:ring-accent-400"),
    state.isPressed &&
      (tone === "danger"
        ? "scale-[0.98] bg-rose-500/15 dark:bg-rose-400/15"
        : "scale-[0.98] bg-neutral-950/10 dark:bg-white/15"),
  );
}

export function ModalSheetSection({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return <div className={cn("px-safe-or-4 sm:px-safe-or-5", className)} {...props} />;
}

export function ModalSheetActions({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return <div className={cn("flex flex-col gap-1", className)} {...props} />;
}

export function ModalSheetChoices({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return (
    <div className={cn("px-safe-or-4 sm:px-safe-or-5 flex flex-col gap-1", className)} {...props} />
  );
}

export function ModalSheetAction({
  children,
  className,
  icon,
  tone = "default",
  ...props
}: Omit<AriaButtonProps, "children"> & {
  children: ReactNode;
  icon: IconProps["icon"];
  tone?: ModalSheetActionTone;
}) {
  return (
    <AriaButton
      className={(state) =>
        cn(
          state.defaultClassName,
          "grid min-h-14 w-full grid-cols-[1.25rem_minmax(0,1fr)] items-center gap-x-4 rounded-2xl py-4 text-left px-safe-or-4 sm:px-safe-or-5",
          sheetRowFeedback(state, tone),
          className,
        )
      }
      {...props}
    >
      <Icon
        icon={icon}
        width={20}
        height={20}
        className={cn(
          "col-start-1 row-start-1 shrink-0",
          tone === "danger"
            ? "text-rose-600 dark:text-rose-300"
            : "text-neutral-600 dark:text-neutral-400",
        )}
      />
      <span className="col-start-2 row-start-1 min-w-0 text-base leading-tight font-medium">
        {children}
      </span>
    </AriaButton>
  );
}

export function ModalSheetChoice({
  children,
  className,
  icon,
  label,
  ...props
}: Omit<ComponentProps<typeof Checkbox>, "children"> & {
  children: ReactNode;
  icon: IconProps["icon"];
  label: ReactNode;
}) {
  return (
    <Checkbox
      {...props}
      className={composeRenderProps(className, (className, state) =>
        cn(
          "min-h-16 w-full flex-row-reverse gap-4 rounded-2xl bg-white px-4 py-2.5 text-left shadow-surface dark:bg-neutral-800",
          sheetRowFeedback(state, "default"),
          (state.isHovered || state.isFocusVisible) && "bg-neutral-50 dark:bg-neutral-700",
          state.isPressed && "bg-neutral-100 dark:bg-neutral-700",
          className,
        ),
      )}
    >
      <span className="grid min-w-0 flex-1 grid-cols-[1.25rem_minmax(0,1fr)] items-center gap-x-4 gap-y-0.5">
        <Icon
          icon={icon}
          width={20}
          height={20}
          className="col-start-1 row-span-2 row-start-1 size-5 self-center text-neutral-600 dark:text-neutral-400"
        />
        <span className="text-sm font-normal text-neutral-600 dark:text-neutral-400">{label}</span>
        <span className="col-start-2 text-base font-semibold break-words text-neutral-950 dark:text-neutral-50">
          {children}
        </span>
      </span>
    </Checkbox>
  );
}

function useModalSheetContext() {
  const context = use(ModalSheetContext);

  if (!context) {
    throw new Error("ModalSheet components must be used within ModalSheet.");
  }

  return context;
}
