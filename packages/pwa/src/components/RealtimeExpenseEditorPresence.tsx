import { view } from "@nkzw/fate";
import type { ExpensePresenceEntity, PartyEntity } from "#src/lib/data/entities.ts";
import type { ExpensePresenceMessage } from "#src/lib/data/presence.ts";
import { useCurrentParticipant } from "#src/hooks/useCurrentParticipant.ts";
import { useMediaFile } from "#src/hooks/useMediaFile.ts";
import { useCurrentParty } from "#src/hooks/useParty.ts";

import { type Expense, type ExpenseParticipantPresence } from "#src/models/expense.ts";
import type { MediaFile } from "#src/models/media.ts";
import type { PartyParticipant } from "#src/models/party.ts";
import { Avatar } from "@trizum/ui/Avatar";
import { useFateClient, useView } from "react-fate";
import { mutationResult } from "#src/lib/data/mutationResult.ts";
import type { AppClient } from "#src/lib/data/LocalFateClient.ts";
import { Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  arePresenceBubblePositionsEqual,
  getPresenceBubblePosition,
  getPresenceElementIdFromTarget,
  type PresenceBubblePosition,
} from "./presencePosition.ts";

const PresenceView = view<ExpensePresenceEntity>()({ participants: true });

const PartyParticipantsView = view<PartyEntity>()({
  id: true,
  available: true,
  participants: true,
});

interface RealtimeExpenseEditorPresenceProps {
  expenseId: Expense["id"];
}

function broadcastPresenceUpdate({
  expenseId,
  client,
  lastSentElementIdRef,
  participantId,
  value,
}: {
  expenseId: Expense["id"];
  client: AppClient;
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

    void mutationResult(client.mutations.presence.broadcast({ input: payload }));

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

  void mutationResult(client.mutations.presence.broadcast({ input: payload }));
}

export function RealtimeExpenseEditorPresence({ expenseId }: RealtimeExpenseEditorPresenceProps) {
  const client = useFateClient();

  const presence = useView(
    PresenceView,
    client.ref<ExpensePresenceEntity>("ExpensePresence", expenseId, PresenceView),
  );

  const participant = useCurrentParticipant();
  const overlayRef = useRef<HTMLDivElement>(null);
  const presenceElementIdRef = useRef<string | null>(null);

  const visiblePresence = presence.participants.filter(
    (entry) => entry.participantId !== participant.id,
  );

  const lastSentElementIdRef = useRef<string | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      if (lastSentElementIdRef.current) {
        broadcastPresenceUpdate({
          expenseId,
          client,
          lastSentElementIdRef,
          participantId: participant.id,
          value: { elementId: lastSentElementIdRef.current },
        });
      }
    }, 5000);

    return () => {
      clearInterval(interval);
    };
  }, [expenseId, client, participant.id]);

  useEffect(() => {
    function updatePresenceFromTarget(target: Element | null, { clearOnMiss = true } = {}) {
      const isWithinDialog = findPopoverFormElementFromTarget(target);
      const presenceElementId = getPresenceElementIdFromTarget(target);

      if (presenceElementId) {
        broadcastPresenceUpdate({
          expenseId,
          client,
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
        client,
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
          client,
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
        client,
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
          client,
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
          client,
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
  }, [expenseId, client, participant.id]);

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
