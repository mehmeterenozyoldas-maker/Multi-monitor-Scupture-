import { useEffect, useRef, useState, useCallback } from 'react';
import { SyncMessage, WindowState, AppEvent } from '../types';
import { CHANNEL_NAME, HEARTBEAT_INTERVAL, PRUNE_TIMEOUT } from '../constants';

export const useWindowSync = () => {
  const [myId] = useState(() => Math.random().toString(36).slice(2, 9));
  const channelRef = useRef<BroadcastChannel | null>(null);
  const peersRef = useRef<Map<string, WindowState>>(new Map());
  const [peerCount, setPeerCount] = useState(1);
  
  // Queue for incoming one-off events (like shockwaves)
  // The visualizer consumes and clears this queue every frame
  const eventQueueRef = useRef<AppEvent[]>([]);
  
  // Track mouse position in a ref to avoid re-renders
  const mouseRef = useRef({ x: 0, y: 0 });

  const getSelfState = useCallback((): WindowState => {
    return {
      id: myId,
      x: window.screenX,
      y: window.screenY,
      w: window.innerWidth,
      h: window.innerHeight,
      mouseX: window.screenX + mouseRef.current.x, // Absolute screen coordinates
      mouseY: window.screenY + mouseRef.current.y,
      lastSeen: Date.now(),
    };
  }, [myId]);

  const broadcast = useCallback((type: 'HELLO' | 'UPDATE' | 'GOODBYE') => {
    if (!channelRef.current) return;
    const state = getSelfState();
    const msg: SyncMessage = { type, ...state };
    channelRef.current.postMessage(msg);
  }, [getSelfState]);

  const broadcastEvent = useCallback((event: AppEvent) => {
    if (!channelRef.current) return;
    // Add to local queue immediately so we see our own actions
    eventQueueRef.current.push(event);
    
    // Send to peers
    const msg: SyncMessage = { 
        type: 'EVENT', 
        id: myId,
        event 
    };
    channelRef.current.postMessage(msg);
  }, [myId]);

  useEffect(() => {
    // Track local mouse movement
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener('mousemove', handleMouseMove);

    // Initialize Channel
    channelRef.current = new BroadcastChannel(CHANNEL_NAME);

    const handleMessage = (event: MessageEvent<SyncMessage>) => {
      const msg = event.data;
      if (msg.id === myId) return;

      if (msg.type === 'GOODBYE') {
        peersRef.current.delete(msg.id);
      } else if (msg.type === 'EVENT' && msg.event) {
        // Push remote events to the queue for the visualizer
        eventQueueRef.current.push(msg.event);
      } else {
        // Standard State Update
        if (msg.x !== undefined && msg.y !== undefined) {
             peersRef.current.set(msg.id, {
              id: msg.id,
              x: msg.x!,
              y: msg.y!,
              w: msg.w!,
              h: msg.h!,
              mouseX: msg.mouseX || 0,
              mouseY: msg.mouseY || 0,
              lastSeen: Date.now(),
            });
        }

        if (msg.type === 'HELLO') {
          broadcast('UPDATE');
        }
      }
      setPeerCount(peersRef.current.size + 1);
    };

    channelRef.current.onmessage = handleMessage;

    broadcast('HELLO');

    const intervalId = setInterval(() => {
      broadcast('UPDATE');
      
      const now = Date.now();
      let changed = false;
      peersRef.current.forEach((peer, id) => {
        if (now - peer.lastSeen > PRUNE_TIMEOUT) {
          peersRef.current.delete(id);
          changed = true;
        }
      });
      
      if (changed) {
        setPeerCount(peersRef.current.size + 1);
      }
    }, HEARTBEAT_INTERVAL);

    const cleanup = () => {
      broadcast('GOODBYE');
      channelRef.current?.close();
      window.removeEventListener('mousemove', handleMouseMove);
    };

    window.addEventListener('beforeunload', cleanup);
    
    return () => {
      clearInterval(intervalId);
      window.removeEventListener('beforeunload', cleanup);
      cleanup();
    };
  }, [myId, broadcast]);

  return { myId, peersRef, peerCount, getSelfState, broadcastEvent, eventQueueRef };
};