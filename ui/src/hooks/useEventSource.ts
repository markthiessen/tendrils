import { useEffect, useRef } from "react";

type Listener = () => void;

let sharedEs: EventSource | null = null;
let refCount = 0;
const listeners = new Map<string, Set<Listener>>();

function getEventSource(): EventSource {
  if (!sharedEs || sharedEs.readyState === EventSource.CLOSED) {
    sharedEs = new EventSource("/events");
    sharedEs.addEventListener("error", () => {
      // Browser will auto-reconnect
    });
  }
  refCount++;
  return sharedEs;
}

function releaseEventSource() {
  refCount--;
  if (refCount <= 0 && sharedEs) {
    sharedEs.close();
    sharedEs = null;
    listeners.clear();
    refCount = 0;
  }
}

function addListener(event: string, fn: Listener) {
  let set = listeners.get(event);
  if (!set) {
    set = new Set();
    listeners.set(event, set);
    sharedEs?.addEventListener(event, () => {
      for (const l of listeners.get(event) ?? []) l();
    });
  }
  set.add(fn);
}

function removeListener(event: string, fn: Listener) {
  listeners.get(event)?.delete(fn);
}

export function useEventSource(events: string[], callback: () => void) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    getEventSource();

    const fn = () => callbackRef.current();
    for (const event of events) {
      addListener(event, fn);
    }

    return () => {
      for (const event of events) {
        removeListener(event, fn);
      }
      releaseEventSource();
    };
  }, [events.join(",")]);
}
