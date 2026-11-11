import type { BackgroundMotionEffect, TransitionType } from '../types/project';

export interface MotionTransform {
  scale: number;
  translateX: number; // in pixels
  translateY: number; // in pixels
  rotation: number;   // in radians
}

export interface TransitionState {
  activeAlpha: number;
  activeTransform?: { translateX: number; translateY: number; scale: number };
  nextAlpha: number;
  nextTransform?: { translateX: number; translateY: number; scale: number };
}

/**
 * Deterministic hash from string (to ensure consistent effect per item across preview and export)
 */
export function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Computes dynamic motion transform for an image over its duration
 */
export function computeImageMotion(
  progress: number,
  effect: BackgroundMotionEffect | undefined,
  seedId: string,
  intensity: number = 1.0,
  canvasW: number,
  canvasH: number
): MotionTransform {
  const eff = effect || 'random';
  if (eff === 'none' || intensity <= 0) {
    return { scale: 1.0, translateX: 0, translateY: 0, rotation: 0 };
  }

  // Smooth easing (sine in-out)
  const eased = 0.5 - 0.5 * Math.cos(progress * Math.PI);

  let variant = 0;
  if (eff === 'random' || eff === 'ken-burns') {
    const hash = hashString(seedId);
    variant = hash % 7; // 7 distinct motion variants
  } else {
    switch (eff) {
      case 'zoom-in': variant = 0; break;
      case 'zoom-out': variant = 1; break;
      case 'pan-left': variant = 2; break;
      case 'pan-right': variant = 3; break;
      case 'pan-up': variant = 4; break;
      case 'pan-down': variant = 5; break;
      case 'wobble': variant = 6; break;
    }
  }

  const basePaddingScale = 1.06; // slight zoom so movement never reveals blank border edges

  switch (variant) {
    case 0: {
      // Zoom In (1.06 -> 1.18)
      const zoom = basePaddingScale * (1.0 + eased * 0.12 * intensity);
      return { scale: zoom, translateX: 0, translateY: 0, rotation: 0 };
    }
    case 1: {
      // Zoom Out (1.18 -> 1.06)
      const zoom = basePaddingScale * (1.12 - eased * 0.12 * intensity);
      return { scale: zoom, translateX: 0, translateY: 0, rotation: 0 };
    }
    case 2: {
      // Pan Left to Right (with subtle breathing zoom)
      const zoom = basePaddingScale * (1.04 + Math.sin(progress * Math.PI) * 0.03 * intensity);
      const panX = (-0.025 + eased * 0.05) * canvasW * intensity;
      return { scale: zoom, translateX: panX, translateY: 0, rotation: 0 };
    }
    case 3: {
      // Pan Right to Left
      const zoom = basePaddingScale * (1.04 + Math.sin(progress * Math.PI) * 0.03 * intensity);
      const panX = (0.025 - eased * 0.05) * canvasW * intensity;
      return { scale: zoom, translateX: panX, translateY: 0, rotation: 0 };
    }
    case 4: {
      // Pan Up (tilt slowly upwards)
      const zoom = basePaddingScale * (1.04 + eased * 0.04 * intensity);
      const panY = (0.02 - eased * 0.04) * canvasH * intensity;
      return { scale: zoom, translateX: 0, translateY: panY, rotation: 0 };
    }
    case 5: {
      // Pan Down (tilt slowly downwards)
      const zoom = basePaddingScale * (1.04 + eased * 0.04 * intensity);
      const panY = (-0.02 + eased * 0.04) * canvasH * intensity;
      return { scale: zoom, translateX: 0, translateY: panY, rotation: 0 };
    }
    case 6:
    default: {
      // Organic Wobble / Subtle Breathing Sway
      const t = progress * Math.PI * 2;
      const zoom = basePaddingScale * (1.03 + Math.sin(t) * 0.025 * intensity);
      const panX = Math.cos(t) * 0.015 * canvasW * intensity;
      const panY = Math.sin(t * 1.5) * 0.012 * canvasH * intensity;
      const rot = Math.sin(t * 0.5) * 0.01 * intensity;
      return { scale: zoom, translateX: panX, translateY: panY, rotation: rot };
    }
  }
}

/**
 * Computes transition alpha and transforms between outgoing (active) and incoming (next) slide
 */
export function computeTransition(
  transition: TransitionType,
  blendFactor: number,
  canvasW: number,
  canvasH: number
): TransitionState {
  if (blendFactor <= 0) {
    return { activeAlpha: 1.0, nextAlpha: 0 };
  }
  if (blendFactor >= 1.0) {
    return { activeAlpha: 0, nextAlpha: 1.0 };
  }

  const eased = 0.5 - 0.5 * Math.cos(blendFactor * Math.PI);

  switch (transition) {
    case 'fade': {
      let activeAlpha = 1.0;
      let nextAlpha = 0;
      if (blendFactor < 0.5) {
        activeAlpha = 1.0 - (blendFactor * 2);
      } else {
        activeAlpha = 0;
        nextAlpha = (blendFactor - 0.5) * 2;
      }
      return { activeAlpha, nextAlpha };
    }
    case 'zoom': {
      return {
        activeAlpha: 1.0 - eased,
        activeTransform: {
          translateX: 0,
          translateY: 0,
          scale: 1.0 + eased * 0.15,
        },
        nextAlpha: eased,
        nextTransform: {
          translateX: 0,
          translateY: 0,
          scale: 1.15 - eased * 0.15,
        },
      };
    }
    case 'slide-left': {
      return {
        activeAlpha: 1.0,
        activeTransform: {
          translateX: -canvasW * eased,
          translateY: 0,
          scale: 1.0,
        },
        nextAlpha: 1.0,
        nextTransform: {
          translateX: canvasW * (1.0 - eased),
          translateY: 0,
          scale: 1.0,
        },
      };
    }
    case 'slide-right': {
      return {
        activeAlpha: 1.0,
        activeTransform: {
          translateX: canvasW * eased,
          translateY: 0,
          scale: 1.0,
        },
        nextAlpha: 1.0,
        nextTransform: {
          translateX: -canvasW * (1.0 - eased),
          translateY: 0,
          scale: 1.0,
        },
      };
    }
    case 'crossfade':
    default: {
      return {
        activeAlpha: 1.0 - eased,
        nextAlpha: eased,
      };
    }
  }
}
