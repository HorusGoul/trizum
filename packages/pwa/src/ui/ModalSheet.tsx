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
  Heading,
  type ButtonProps as AriaButtonProps,
  type HeadingProps,
} from "react-aria-components";
import { Sheet, type SheetProps } from "react-modal-sheet";
import {
  createContext,
  type ComponentPropsWithoutRef,
  type ReactNode,
  use,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { IconWithFallback, type IconProps } from "./Icon";
import { cn, type ClassName } from "./utils";

interface ModalSheetContextValue {
  descriptionId: string;
  setHasDescription: (hasDescription: boolean) => void;
  setHasTitle: (hasTitle: boolean) => void;
  titleId: string;
}

const ModalSheetContext = createContext<ModalSheetContextValue | null>(null);

interface ModalSheetProps
  extends Omit<
    SheetProps,
    | "children"
    | "className"
    | "isOpen"
    | "onClose"
    | "onContextMenu"
    | "unstyled"
  > {
  children: ReactNode;
  className?: ClassName;
  isDismissable?: boolean;
  isOpen: boolean;
  onContextMenu?: ComponentPropsWithoutRef<"div">["onContextMenu"];
  onOpenChange?: (isOpen: boolean) => void;
  overlayClassName?: ClassName;
}

export function ModalSheet({
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
    <Sheet
      disableDismiss={disableDismiss ?? !isDismissable}
      detent={detent}
      isOpen={isOpen}
      onClose={close}
      style={{ zIndex: 50 }}
      unstyled
      {...props}
    >
      <OverlayProvider>
        <FocusScope contain restoreFocus>
          <AccessibleSheetContainer
            className={className}
            close={close}
            isDismissable={isDismissable}
            isOpen={isOpen}
          >
            {children}
          </AccessibleSheetContainer>
        </FocusScope>

        <Sheet.Backdrop
          className={cn(
            "bg-accent-950/45 backdrop-blur-[2px]",
            overlayClassName,
          )}
          onContextMenu={(event) => {
            onContextMenu?.(event);
            event.preventDefault();
          }}
          onTap={isDismissable ? close : undefined}
        />
      </OverlayProvider>
    </Sheet>
  );
}

function AccessibleSheetContainer({
  children,
  className,
  close,
  isDismissable,
  isOpen,
}: {
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
  const { dialogProps } = useDialog({}, containerRef);

  return (
    <ModalSheetContext
      value={{
        descriptionId,
        setHasDescription,
        setHasTitle,
        titleId,
      }}
    >
      <Sheet.Container
        className={cn(
          "mt-12 w-full max-w-xl overflow-hidden rounded-t-[1.75rem] border border-accent-200/80 bg-gradient-to-b from-white via-white to-accent-50/95 shadow-[0_-10px_40px_rgba(15,23,42,0.24)] sm:mt-0 sm:rounded-[1.75rem] dark:border-accent-800 dark:from-accent-950 dark:via-accent-950 dark:to-accent-900 dark:shadow-none",
          className,
        )}
      >
        <div
          {...mergeProps(overlayProps, modalProps, dialogProps)}
          ref={containerRef}
          aria-describedby={hasDescription ? descriptionId : undefined}
          aria-labelledby={hasTitle ? titleId : undefined}
          className="flex min-h-0 flex-1 flex-col outline-none"
        >
          {isDismissable ? <DismissButton onDismiss={close} /> : null}
          {children}
          {isDismissable ? <DismissButton onDismiss={close} /> : null}
        </div>
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
              className="h-1.5 w-12 rounded-full bg-accent-200 dark:bg-accent-700"
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
        "text-base font-semibold tracking-tight text-accent-950 dark:text-accent-50",
        className,
      )}
      {...props}
    />
  );
}

export function ModalSheetDescription({
  className,
  ...props
}: ComponentPropsWithoutRef<"p">) {
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
      className={cn("text-sm text-accent-700 dark:text-accent-300", className)}
      {...props}
    />
  );
}

export function ModalSheetContent({
  className,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <Sheet.Content className="min-h-0">
      <div
        className={cn(
          "min-h-0 overflow-y-auto px-safe pb-safe-offset-4",
          className,
        )}
        {...props}
      />
    </Sheet.Content>
  );
}

export type ModalSheetActionTone = "default" | "danger";

export function ModalSheetSection({
  className,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div className={cn("px-safe-or-4 sm:px-safe-or-5", className)} {...props} />
  );
}

export function ModalSheetActions({
  className,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return <div className={cn("flex flex-col gap-1", className)} {...props} />;
}

export function ModalSheetAction({
  children,
  className,
  icon,
  tone = "default",
  ...props
}: Omit<AriaButtonProps, "children"> & {
  children: ReactNode;
  icon: IconProps["name"];
  tone?: ModalSheetActionTone;
}) {
  return (
    <AriaButton
      className={({ defaultClassName, isFocusVisible, isHovered, isPressed }) =>
        cn(
          defaultClassName,
          "grid min-h-14 w-full grid-cols-[1.25rem_minmax(0,1fr)] items-center gap-x-4 rounded-[1.35rem] py-4 text-left outline-none transition-all duration-200 ease-in-out px-safe-or-4 sm:px-safe-or-5",
          tone === "danger"
            ? "text-rose-700 dark:text-rose-300"
            : "text-accent-950 dark:text-accent-50",
          isHovered &&
            (tone === "danger"
              ? "bg-rose-50 dark:bg-rose-950/30"
              : "bg-accent-100 dark:bg-accent-900"),
          isFocusVisible &&
            (tone === "danger"
              ? "bg-rose-50 ring-2 ring-rose-300 dark:bg-rose-950/30 dark:ring-rose-800"
              : "bg-accent-100 ring-2 ring-accent-300 dark:bg-accent-900 dark:ring-accent-700"),
          isPressed &&
            (tone === "danger"
              ? "scale-[0.98] bg-rose-100 dark:bg-rose-950/50"
              : "scale-[0.98] bg-accent-200 dark:bg-accent-800"),
          className,
        )
      }
      {...props}
    >
      <IconWithFallback
        name={icon}
        size={20}
        className={cn(
          "col-start-1 row-start-1 flex-shrink-0",
          tone === "danger"
            ? "text-rose-600 dark:text-rose-300"
            : "text-accent-700 dark:text-accent-200",
        )}
      />
      <span className="col-start-2 row-start-1 min-w-0 text-base font-medium leading-tight">
        {children}
      </span>
    </AriaButton>
  );
}

function useModalSheetContext() {
  const context = use(ModalSheetContext);

  if (!context) {
    throw new Error("ModalSheet components must be used within ModalSheet.");
  }

  return context;
}
