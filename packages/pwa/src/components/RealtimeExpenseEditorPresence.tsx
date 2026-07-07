import { useCurrentParticipant } from "#src/hooks/useCurrentParticipant.ts";
import { useMediaFile } from "#src/hooks/useMediaFile.ts";
import { useCurrentParty } from "#src/hooks/useParty.ts";
import { useSuspenseDocument } from "#src/lib/automerge/suspense-hooks.ts";
import {
  decodeExpenseId,
  type Expense,
  type ExpenseParticipantPresence,
} from "#src/models/expense.ts";
import type { MediaFile } from "#src/models/media.ts";
import type { PartyExpenseChunk, PartyParticipant } from "#src/models/party.ts";
import { Avatar } from "#src/ui/Avatar.tsx";
import { getLogger } from "#src/lib/log.ts";
import type { DocHandle, DocHandleEphemeralMessagePayload } from "@automerge/automerge-repo";
import { Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import { getPresenceBubblePosition } from "./presencePosition.ts";

const logger = getLogger("components", "RealtimeExpenseEditorPresence");

interface RealtimeExpenseEditorPresenceProps {
  expenseId: Expense["id"];
}

type ExpensePresenceUpdatePayload = {
  type: "expense-presence-update";
  data: ExpenseParticipantPresence & {
    expenseId: Expense["id"];
  };
};

type ExpensePresenceDeletePayload = {
  type: "expense-presence-delete";
  data: {
    participantId: PartyParticipant["id"];
    expenseId: Expense["id"];
  };
};

function broadcastPresenceUpdate({
  expenseId,
  handle,
  lastSentElementIdRef,
  participantId,
  value,
}: {
  expenseId: Expense["id"];
  handle: DocHandle<PartyExpenseChunk>;
  lastSentElementIdRef: React.RefObject<string | null>;
  participantId: PartyParticipant["id"];
  value: Pick<ExpenseParticipantPresence, "elementId"> | null;
}) {
  if (!value) {
    lastSentElementIdRef.current = null;
    const payload: ExpensePresenceDeletePayload = {
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
  const payload: ExpensePresenceUpdatePayload = {
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
  const { chunkId } = decodeExpenseId(expenseId);
  const [, handle] = useSuspenseDocument<PartyExpenseChunk>(chunkId, {
    required: true,
  });
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
    const listener = ({ message }: DocHandleEphemeralMessagePayload<PartyExpenseChunk>) => {
      const payload = message as ExpensePresenceDeletePayload | ExpensePresenceUpdatePayload;

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

    handle.on("ephemeral-message", listener);

    return () => {
      handle.off("ephemeral-message", listener);
    };
  }, [handle, expenseId, participant.id]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      const target = event.target as HTMLElement;

      const isWithinDialog = findPopoverFormElementFromTarget(target);
      const presenceElementId = findPresenceElementFromTarget(target);

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

      if (isWithinDialog || presenceElementId) {
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

    window.addEventListener("click", onClick, { capture: true });

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
      const element = document.activeElement as HTMLElement;
      const presenceElementId = findPresenceElementFromTarget(element);

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
      window.removeEventListener("click", onClick, { capture: true });
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", onWindowBlur);
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
  const { party } = useCurrentParty();
  const participant = party.participants[presence.participantId];
  const [position, setPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);

  useLayoutEffect(() => {
    const element = document.querySelector<HTMLElement>(
      `[data-presence-element-id="${presence.elementId}"]`,
    );
    const overlayElement = overlayRef.current;

    if (!element || !overlayElement) {
      return;
    }

    const targetElement = element;
    const targetOverlayElement = overlayElement;

    function updatePosition() {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Presence bubbles need committed DOM measurements.
      setPosition(getPresenceBubblePosition(targetElement, targetOverlayElement));
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    const resizeObserver = "ResizeObserver" in window ? new ResizeObserver(updatePosition) : null;
    resizeObserver?.observe(targetElement);
    resizeObserver?.observe(targetOverlayElement);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      resizeObserver?.disconnect();
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

function findPresenceElementFromTarget(target: HTMLElement): string | null {
  if (!target) {
    return null;
  }

  // Check if the target has a data-presence-element-id attribute
  const presenceElementId =
    target.dataset?.presenceElementId ?? target.dataset?.presenceProxyElementId;

  if (presenceElementId) {
    return presenceElementId;
  }

  if (target.parentElement) {
    return findPresenceElementFromTarget(target.parentElement);
  }

  return null;
}

function findPopoverFormElementFromTarget(target: HTMLElement): HTMLElement | null {
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
