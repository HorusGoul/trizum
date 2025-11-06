import { useCurrentParticipant } from "#src/hooks/useCurrentParticipant.ts";
import { useMediaFile } from "#src/hooks/useMediaFile.ts";
import { useCurrentParty } from "#src/hooks/useParty.ts";
import type {
  Expense,
  ExpenseParticipantPresence,
} from "#src/models/expense.ts";
import type { MediaFile } from "#src/models/media.ts";
import { Avatar } from "#src/ui/Avatar.tsx";
import { Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";

interface RealtimeExpenseEditorPresenceProps {
  presence: Expense["__presence"];
  onPresenceUpdate: (
    value: Pick<ExpenseParticipantPresence, "elementId"> | null,
  ) => void;
}

export function RealtimeExpenseEditorPresence({
  presence = {},
  onPresenceUpdate,
}: RealtimeExpenseEditorPresenceProps) {
  const participant = useCurrentParticipant();
  const presenceElementIdRef = useRef<string | null>(null);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      const target = event.target as HTMLElement;

      const isWithinDialog = findPopoverFormElementFromTarget(target);
      const presenceElementId = findPresenceElementFromTarget(target);

      if (presenceElementId) {
        onPresenceUpdate({ elementId: presenceElementId });
        presenceElementIdRef.current = presenceElementId;
        return;
      }

      if (isWithinDialog || presenceElementId) {
        return;
      }

      onPresenceUpdate(null);
      presenceElementIdRef.current = null;
    }

    window.addEventListener("click", onClick, { capture: true });

    // visibility change listener
    function onVisibilityChange() {
      if (document.visibilityState === "hidden") {
        onPresenceUpdate(null);
        presenceElementIdRef.current = null;
      }
    }

    document.addEventListener("visibilitychange", onVisibilityChange);

    function onWindowBlur() {
      onPresenceUpdate(null);
      presenceElementIdRef.current = null;
    }

    function onWindowFocus() {
      // Grab element in focus
      const element = document.activeElement as HTMLElement;
      const presenceElementId = findPresenceElementFromTarget(element);

      if (presenceElementId) {
        onPresenceUpdate({ elementId: presenceElementId });
        presenceElementIdRef.current = presenceElementId;
      }
    }

    window.addEventListener("blur", onWindowBlur);
    window.addEventListener("focus", onWindowFocus);

    const interval = setInterval(() => {
      if (presenceElementIdRef.current) {
        onPresenceUpdate({ elementId: presenceElementIdRef.current });
      }
    }, 5000);

    return () => {
      window.removeEventListener("click", onClick, { capture: true });
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", onWindowBlur);
      clearInterval(interval);
    };
  }, [onPresenceUpdate]);

  return (
    <div className="pointer-events-none absolute inset-0 touch-none">
      {Object.values(presence)
        .filter((presence) => {
          if (presence.participantId === participant.id) {
            // Don't show the bubble for the current participant
            return false;
          }

          // eslint-disable-next-line react-hooks/purity -- TODO: Fix this and we probably want it to be a hook that updates from time to time
          if (presence.dateTime < new Date(Date.now() - 10000)) {
            // Don't show the bubble for participants who have not been active in the last 10 seconds
            return false;
          }

          return true;
        })
        .map((presence) => (
          <Suspense key={presence.participantId}>
            <Bubble presence={presence} />
          </Suspense>
        ))}
    </div>
  );
}

function Bubble({ presence }: { presence: ExpenseParticipantPresence }) {
  const { party } = useCurrentParty();
  const participant = party.participants[presence.participantId];
  const [position, setPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);

  useLayoutEffect(() => {
    const element = document.querySelector(
      `[data-presence-element-id="${presence.elementId}"]`,
    ) as HTMLElement;

    if (!element) {
      return;
    }

    const width = element.offsetWidth;

    const offsetTop = Number(element.dataset?.presenceOffsetTop ?? 0);
    const offsetLeft = Number(element.dataset?.presenceOffsetLeft ?? 0);

    // eslint-disable-next-line react-hooks/set-state-in-effect -- This is fine for now
    setPosition({
      top: element.offsetTop + offsetTop,
      left: element.offsetLeft + width + offsetLeft,
    });
  }, [presence.elementId]);

  if (!position) {
    return null;
  }

  if (participant.avatarId) {
    return (
      <Suspense
        fallback={
          <AvatarWrapper
            name={participant.name}
            top={position.top}
            left={position.left}
          />
        }
      >
        <AvatarWithAvatarId
          avatarId={participant.avatarId}
          name={participant.name}
          top={position.top}
          left={position.left}
        />
      </Suspense>
    );
  }

  return (
    <AvatarWrapper
      name={participant.name}
      top={position.top}
      left={position.left}
    />
  );
}

function AvatarWithAvatarId({
  avatarId,
  name,
  top,
  left,
}: {
  avatarId: MediaFile["id"];
  name: string;
  top: number;
  left: number;
}) {
  const { url } = useMediaFile(avatarId);
  return <AvatarWrapper url={url} name={name} top={top} left={left} />;
}

function AvatarWrapper({
  url,
  name,
  top,
  left,
}: {
  url?: string;
  name: string;
  top: number;
  left: number;
}) {
  return (
    <Avatar
      url={url}
      name={name}
      className="absolute z-50 h-5 w-5 -translate-x-1/2 -translate-y-1/2 bg-accent-500 text-white shadow-xl transition-all duration-500 ease-in-out"
      style={{
        top,
        left,
      }}
    />
  );
}

function findPresenceElementFromTarget(target: HTMLElement): string | null {
  if (!target) {
    return null;
  }

  // Check if the target has a data-presence-element-id attribute
  const presenceElementId = target.dataset?.presenceElementId;

  if (presenceElementId) {
    return presenceElementId;
  }

  if (target.parentElement) {
    return findPresenceElementFromTarget(target.parentElement);
  }

  return null;
}

function findPopoverFormElementFromTarget(
  target: HTMLElement,
): HTMLElement | null {
  if (!target) {
    return null;
  }

  if (
    target.tagName === "DIALOG" ||
    target.role === "dialog" ||
    target.role === "listbox"
  ) {
    return target;
  }

  if (target.parentElement) {
    return findPopoverFormElementFromTarget(target.parentElement);
  }

  return null;
}
