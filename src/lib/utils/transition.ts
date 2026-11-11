import type { OverlayTransitionType } from '../types/project';

export interface TransitionState {
  alphaMultiplier: number;
  scaleMultiplier: number;
  offsetY: number;
  isVisible: boolean;
}

export function computeOverlayTransition(
  currentTime: number,
  startTime: number = 0,
  endTime: number = 0,
  transition: OverlayTransitionType = 'none',
  transitionDuration: number = 0.5,
  heightReference: number = 1080
): TransitionState {
  const start = startTime ?? 0;
  const hasEnd = endTime !== undefined && endTime > 0;
  const end = hasEnd ? endTime : Infinity;

  // Fully out of bounds
  if (currentTime < start || (hasEnd && currentTime > end)) {
    return { alphaMultiplier: 0, scaleMultiplier: 1, offsetY: 0, isVisible: false };
  }

  if (!transition || transition === 'none') {
    return { alphaMultiplier: 1, scaleMultiplier: 1, offsetY: 0, isVisible: true };
  }

  const dur = Math.max(0.1, transitionDuration || 0.5);
  let progress = 1.0; // 0 (hidden) to 1 (fully visible)

  // In-transition
  const elapsedFromStart = currentTime - start;
  if (elapsedFromStart < dur) {
    progress = Math.min(progress, elapsedFromStart / dur);
  }

  // Out-transition
  if (hasEnd) {
    const remainingToEnd = end - currentTime;
    if (remainingToEnd < dur) {
      progress = Math.min(progress, Math.max(0, remainingToEnd / dur));
    }
  }

  // Smooth ease-in-out cubic
  const ease = progress < 0.5 
    ? 4 * progress * progress * progress 
    : 1 - Math.pow(-2 * progress + 2, 3) / 2;

  let alpha = 1.0;
  let scale = 1.0;
  let offsetY = 0;

  if (transition === 'fade') {
    alpha = ease;
  } else if (transition === 'zoom') {
    alpha = ease;
    scale = 0.5 + 0.5 * ease;
  } else if (transition === 'slide-up') {
    alpha = ease;
    offsetY = (1 - ease) * (heightReference * 0.15);
  } else if (transition === 'slide-down') {
    alpha = ease;
    offsetY = -(1 - ease) * (heightReference * 0.15);
  }

  return {
    alphaMultiplier: alpha,
    scaleMultiplier: scale,
    offsetY,
    isVisible: progress > 0.001
  };
}
