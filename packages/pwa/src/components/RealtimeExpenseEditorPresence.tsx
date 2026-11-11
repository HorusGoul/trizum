import { ExpenseIdentityView, PartyParticipantsView } from "#src/lib/data/views.ts";
import type { ExpenseEntity } from "#src/lib/data/entities.ts";
import type { ExpensePresenceMessage } from "#src/lib/data/presence.ts";
import { useCurrentParticipant } from "#src/hooks/useCurrentParticipant.ts";
import { useMediaFile } from "#src/hooks/useMediaFile.ts";
import { useCurrentParty } from "#src/hooks/useParty.ts";
import { useRequiredView } from "#src/lib/data/hooks.ts";
import { type Expense, type ExpenseParticipantPresence } from "#src/models/expense.ts";
import type { MediaFile } from "#src/models/media.ts";
import type { PartyParticipant } from "#src/models/party.ts";
import { Avatar } from "@trizum/ui/Avatar";
import { getLogger } from "#src/lib/log.ts";
import { useAppData } from "#src/lib/data/useAppData.ts";
import type { AppData } from "#src/lib/data/client.ts";
import { Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  arePresenceBubblePositionsEqual,
  getPresenceBubblePosition,
  getPresenceElementIdFromTarget,
  type PresenceBubblePosition,
} from "./presencePosition.ts";

const logger = getLogger("components", "RealtimeExpenseEditorPresence");

interface RealtimeExpenseEditorPresenceProps {
  expenseId: Expense["id"];
}

function broadcastPresenceUpdate({
  expenseId,
  handle,
  lastSentElementIdRef,
  participantId,
  value,
}: {
  expenseId: Expense["id"];
  handle: ReturnType<AppData["presence"]>;
  lastSentElementIdRef: React.RefObject<string | null>;
  participantId: PartyParticipant["id"];
  value: Pick<ExpenseParticipantPresence, "elementId"> | null;
}) {
  if (!value) {
    lastSentElementIdRef.current = null;

    const payload: ExpensePresenceMessage = {
      type: "expense-presence-delete",
      data: {
        participantId,
        expenseId,
      },
    };

    handle.broadcast(payload);

    return;
  }

  lastSentElementIdRef.current = value.elementId;

  const payload: ExpensePresenceMessage = {
    type: "expense-presence-update",
    data: {
      elementId: value.elementId,
      participantId,
      dateTime: new Date(),
      expenseId,
    },
  };

  handle.broadcast(payload);
}

export function RealtimeExpenseEditorPresence({ expenseId }: RealtimeExpenseEditorPresenceProps) {
  const data = useAppData();
  useRequiredView(
    ExpenseIdentityView,
    data.entityRef<ExpenseEntity>("Expense", expenseId, ExpenseIdentityView),
  );
  const handle = data.presence(expenseId);
  const participant = useCurrentParticipant();
  const overlayRef = useRef<HTMLDivElement>(null);
  const presenceElementIdRef = useRef<string | null>(null);
  const [visiblePresence, setVisiblePresence] = useState<ExpenseParticipantPresence[]>([]);
  const lastSentElementIdRef = useRef<string | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      const stalePresenceCutoff = new Date(Date.now() - 10000);

      setVisiblePresence((currentPresence) =>
        currentPresence.filter(
          (participantPresence) =>
            participantPresence.participantId !== participant.id &&
            participantPresence.dateTime >= stalePresenceCutoff,
        ),
      );

      if (lastSentElementIdRef.current) {
        broadcastPresenceUpdate({
          expenseId,
          handle,
          lastSentElementIdRef,
          participantId: participant.id,
          value: { elementId: lastSentElementIdRef.current },
        });
      }
    }, 5000);

    return () => {
      clearInterval(interval);
    };
  }, [expenseId, handle, participant.id]);

  useEffect(() => {
    const listener = ({ message }: { message: unknown }) => {
      // SAFETY: The ephemeral channel is owned by the expense-presence sender; the following try block checks fields and ignores malformed messages.
      const payload = message as ExpensePresenceMessage;

      try {
        if (payload.data.expenseId !== expenseId) {
          return;
        }

        switch (payload.type) {
          case "expense-presence-delete":
            setVisiblePresence((currentPresence) =>
              currentPresence.filter(
                (participantPresence) =>
                  participantPresence.participantId !== payload.data.participantId,
              ),
            );
            break;
          case "expense-presence-update":
            if (payload.data.participantId === participant.id) {
              return;
            }

            setVisiblePresence((currentPresence) => [
              ...currentPresence.filter(
                (participantPresence) =>
                  participantPresence.participantId !== payload.data.participantId,
              ),
              payload.data,
            ]);
            break;
        }
      } catch {
        logger.error("Failed to handle ephemeral message", { payload });

        return;
      }
    };

    return handle.subscribe(listener);
  }, [handle, expenseId, participant.id]);

  useEffect(() => {
    function updatePresenceFromTarget(target: Element | null, { clearOnMiss = true } = {}) {
      const isWithinDialog = findPopoverFormElementFromTarget(target);
      const presenceElementId = getPresenceElementIdFromTarget(target);

      if (presenceElementId) {
        broadcastPresenceUpdate({
          expenseId,
          handle,
          lastSentElementIdRef,
          participantId: participant.id,
          value: { elementId: presenceElementId },
        });
        presenceElementIdRef.current = presenceElementId;

        return;
      }

      if (isWithinDialog || !clearOnMiss) {
        return;
      }

      broadcastPresenceUpdate({
        expenseId,
        handle,
        lastSentElementIdRef,
        participantId: participant.id,
        value: null,
      });
      presenceElementIdRef.current = null;
    }

    function getElementFromEventTarget(target: EventTarget | null) {
      return target instanceof Element ? target : null;
    }

    function onPointerDown(event: PointerEvent) {
      updatePresenceFromTarget(getElementFromEventTarget(event.target));
    }

    function onClick(event: MouseEvent) {
      updatePresenceFromTarget(getElementFromEventTarget(event.target));
    }

    function onFocusIn(event: FocusEvent) {
      updatePresenceFromTarget(getElementFromEventTarget(event.target), { clearOnMiss: false });
    }

    window.addEventListener("pointerdown", onPointerDown, { capture: true });
    window.addEventListener("click", onClick, { capture: true });
    window.addEventListener("focusin", onFocusIn, { capture: true });

    // visibility change listener
    function onVisibilityChange() {
      if (document.visibilityState === "hidden") {
        broadcastPresenceUpdate({
          expenseId,
          handle,
          lastSentElementIdRef,
          participantId: participant.id,
          value: null,
        });
        presenceElementIdRef.current = null;
      }
    }

    document.addEventListener("visibilitychange", onVisibilityChange);

    function onWindowBlur() {
      broadcastPresenceUpdate({
        expenseId,
        handle,
        lastSentElementIdRef,
        participantId: participant.id,
        value: null,
      });
      presenceElementIdRef.current = null;
    }

    function onWindowFocus() {
      // Grab element in focus
      const element = document.activeElement;
      const presenceElementId = getPresenceElementIdFromTarget(element);

      if (presenceElementId) {
        broadcastPresenceUpdate({
          expenseId,
          handle,
          lastSentElementIdRef,
          participantId: participant.id,
          value: { elementId: presenceElementId },
        });
        presenceElementIdRef.current = presenceElementId;
      }
    }

    window.addEventListener("blur", onWindowBlur);
    window.addEventListener("focus", onWindowFocus);

    const interval = setInterval(() => {
      if (presenceElementIdRef.current) {
        broadcastPresenceUpdate({
          expenseId,
          handle,
          lastSentElementIdRef,
          participantId: participant.id,
          value: { elementId: presenceElementIdRef.current },
        });
      }
    }, 5000);

    return () => {
      window.removeEventListener("pointerdown", onPointerDown, { capture: true });
      window.removeEventListener("click", onClick, { capture: true });
      window.removeEventListener("focusin", onFocusIn, { capture: true });
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", onWindowBlur);
      window.removeEventListener("focus", onWindowFocus);
      clearInterval(interval);
    };
  }, [expenseId, handle, participant.id]);

  return (
    <div ref={overlayRef} className="pointer-events-none absolute inset-0 touch-none">
      {visiblePresence.map((presence) => (
        <Suspense key={presence.participantId}>
          <Bubble presence={presence} overlayRef={overlayRef} />
        </Suspense>
      ))}
    </div>
  );
}

function Bubble({
  presence,
  overlayRef,
}: {
  presence: ExpenseParticipantPresence;
  overlayRef: React.RefObject<HTMLDivElement | null>;
}) {
  const { party } = useCurrentParty(PartyParticipantsView);
  const participant = party.participants[presence.participantId];

  const [position, setPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);

  useLayoutEffect(() => {
    const selector = `[data-presence-element-id="${presence.elementId}"]`;
    let currentPosition: PresenceBubblePosition | null = null;
    let frameId: number | null = null;

    function setNextPosition(nextPosition: PresenceBubblePosition | null) {
      if (arePresenceBubblePositionsEqual(currentPosition, nextPosition)) {
        return;
      }

      currentPosition = nextPosition;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Presence bubbles need committed DOM measurements.
      setPosition(nextPosition);
    }

    function updatePosition() {
      const element = document.querySelector<HTMLElement>(selector);
      const overlayElement = overlayRef.current;

      if (!element || !overlayElement) {
        setNextPosition(null);

        return;
      }

      setNextPosition(getPresenceBubblePosition(element, overlayElement));
    }

    function updatePositionOnAnimationFrame() {
      updatePosition();
      frameId = window.requestAnimationFrame(updatePositionOnAnimationFrame);
    }

    updatePositionOnAnimationFrame();

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [overlayRef, presence.elementId]);

  if (!position) {
    return null;
  }

  if (participant.avatarId) {
    return (
      <Suspense
        fallback={<AvatarWrapper name={participant.name} top={position.top} left={position.left} />}
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

  return <AvatarWrapper name={participant.name} top={position.top} left={position.left} />;
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
      className="bg-accent-500 absolute z-50 h-5 w-5 -translate-x-1/2 -translate-y-1/2 text-white shadow-xl transition-all duration-500 ease-in-out"
      style={{
        top,
        left,
      }}
    />
  );
}

function findPopoverFormElementFromTarget(target: Element | null): Element | null {
  if (!target) {
    return null;
  }

  if (target.tagName === "DIALOG" || target.role === "dialog" || target.role === "listbox") {
    return target;
  }

  if (target.parentElement) {
    return findPopoverFormElementFromTarget(target.parentElement);
  }

  return null;
}
