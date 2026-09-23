import { ZoomIn, ZoomOut, RotateCcw, AlignCenter, MapPin, RectangleHorizontal, Maximize2 } from 'lucide-react';

interface PlotToolbarProps {
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onReset?: () => void;
  onAutoScale?: () => void;
  onMarker?: () => void;
  onRegion?: () => void;
  onFullscreen?: () => void;
  activeTools?: string[];
}

export default function PlotToolbar({
  onZoomIn, onZoomOut, onReset, onAutoScale,
  onMarker, onRegion, onFullscreen, activeTools = []
}: PlotToolbarProps) {
  return (
    <div className="plot-toolbar">
      <button className={`plot-toolbar-btn ${activeTools.includes('zoom-in') ? 'active' : ''}`} onClick={onZoomIn} title="Zoom In">
        <ZoomIn size={11} /> Zoom+
      </button>
      <button className={`plot-toolbar-btn ${activeTools.includes('zoom-out') ? 'active' : ''}`} onClick={onZoomOut} title="Zoom Out">
        <ZoomOut size={11} /> Zoom-
      </button>
      <button className="plot-toolbar-btn" onClick={onReset} title="Reset View">
        <RotateCcw size={11} /> Reset
      </button>
      <div className="plot-toolbar-sep" />
      <button className="plot-toolbar-btn" onClick={onAutoScale} title="Auto Scale">
        <AlignCenter size={11} /> Auto Scale
      </button>
      <button className={`plot-toolbar-btn ${activeTools.includes('marker') ? 'active' : ''}`} onClick={onMarker} title="Place Marker">
        <MapPin size={11} /> Marker
      </button>
      <button className={`plot-toolbar-btn ${activeTools.includes('region') ? 'active' : ''}`} onClick={onRegion} title="Select Region">
        <RectangleHorizontal size={11} /> Region
      </button>
      <div className="plot-toolbar-sep" />
      <button className="plot-toolbar-btn" onClick={onFullscreen} title="Fullscreen">
        <Maximize2 size={11} /> Fullscreen
      </button>
    </div>
  );
}
