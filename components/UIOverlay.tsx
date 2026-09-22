import React from 'react';
import { WindowState } from '../types';

interface UIOverlayProps {
  myId: string;
  peerCount: number;
  peers: Map<string, WindowState>;
}

export const UIOverlay: React.FC<UIOverlayProps> = ({ myId, peerCount }) => {
  const openNewWindow = (e: React.MouseEvent) => {
    // Prevent the click from passing through to the canvas or triggering default behaviors
    e.preventDefault();
    e.stopPropagation();

    const w = 600;
    const h = 600;
    
    // Cross-browser screen position
    // standard is screenX/screenY, older browsers or some modes use screenLeft/screenTop
    const screenLeft = window.screenX ?? (window as any).screenLeft ?? 0;
    const screenTop = window.screenY ?? (window as any).screenTop ?? 0;
    const screenWidth = window.screen.availWidth || window.innerWidth;
    
    // Default to opening to the right of the current window
    // Use outerWidth to account for window decorations/borders
    let left = screenLeft + (window.outerWidth || window.innerWidth) + 10;
    let top = screenTop;

    // Boundary Check:
    // If opening to the right would push the new window significantly off the primary monitor's available width
    // (and assuming we might not have a second monitor extended there), we cascade it instead.
    // Note: This is a conservative check. In a real multi-monitor setup, 'availWidth' usually refers to the current monitor.
    // We optimistically allow it if we are fairly sure, but fallback to cascade if it looks like a single screen maxed out.
    if (left + w > screenLeft + screenWidth) {
        // Fallback: Cascade diagonally
        left = screenLeft + 40;
        top = screenTop + 40;
    }

    const features = `width=${w},height=${h},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes`;
    
    try {
      const newWin = window.open(window.location.href, '_blank', features);
      if (!newWin) {
        alert("Window blocked! Please allow pop-ups for this site to enable the multi-window experience.");
      }
    } catch (err) {
      console.error("Failed to open window:", err);
      alert("Error opening window. Check console for details.");
    }
  };

  return (
    <div className="fixed top-4 left-4 z-50 flex flex-col gap-4 pointer-events-none">
      {/* Status Card */}
      <div className="bg-slate-900/80 backdrop-blur-md border border-cyan-500/30 p-4 rounded-lg shadow-[0_0_15px_rgba(0,255,255,0.1)] max-w-xs pointer-events-auto transition-all hover:border-cyan-500/50">
        <h1 className="text-cyan-400 font-bold text-lg tracking-wider uppercase mb-1">
          Neural Sync
        </h1>
        <div className="space-y-1 text-xs text-slate-300 font-mono">
          <div className="flex justify-between">
            <span>NODE_ID:</span>
            <span className="text-cyan-200">{myId}</span>
          </div>
          <div className="flex justify-between">
            <span>NETWORK_STATUS:</span>
            <span className="text-emerald-400">CONNECTED</span>
          </div>
          <div className="flex justify-between">
            <span>ACTIVE_NODES:</span>
            <span className="text-white font-bold">{peerCount}</span>
          </div>
        </div>
      </div>

      {/* Action Button */}
      <button
        type="button"
        onClick={openNewWindow}
        className="pointer-events-auto bg-cyan-950/80 hover:bg-cyan-800/80 text-cyan-100 border border-cyan-500/50 px-5 py-3 rounded-full 
        font-semibold text-sm tracking-wide transition-all shadow-[0_0_20px_rgba(6,182,212,0.2)] hover:shadow-[0_0_30px_rgba(6,182,212,0.4)] hover:scale-105 active:scale-95 flex items-center gap-2 group cursor-pointer"
      >
        <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
        INITIATE NEW NODE
      </button>
      
      <div className="text-[10px] text-cyan-600/60 max-w-[200px] pointer-events-auto">
        If pop-up is blocked, check your browser address bar settings.
      </div>
    </div>
  );
};