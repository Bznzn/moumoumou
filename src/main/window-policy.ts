import type {AppConfig} from '../shared/model';
export type OverlaySignals={hovered:boolean;dragging:boolean;otherAppFullscreen:boolean;userHidden:boolean};
export function resolveOverlay(config:AppConfig,signals:OverlaySignals):{opacity:number;visible:boolean}{
  const a=config.appearance;
  const opacity=signals.dragging?1:signals.hovered?(signals.otherAppFullscreen?a.fullScreenHoverOpacity:a.hoverOpacity):signals.otherAppFullscreen?a.fullScreenOpacity:1;
  return {opacity,visible:!signals.userHidden};
}
