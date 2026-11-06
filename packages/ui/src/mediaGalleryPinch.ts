export type MediaGalleryPoint = readonly [x: number, y: number];

export function calculateMediaGalleryPinchTransform({
  currentPosition,
  currentScale,
  nextOrigin,
  nextScale,
  previousOrigin,
}: {
  currentPosition: MediaGalleryPoint;
  currentScale: number;
  nextOrigin: MediaGalleryPoint;
  nextScale: number;
  previousOrigin: MediaGalleryPoint;
}) {
  const scaleRatio = nextScale / currentScale;

  return {
    x: nextOrigin[0] - (previousOrigin[0] - currentPosition[0]) * scaleRatio,
    y: nextOrigin[1] - (previousOrigin[1] - currentPosition[1]) * scaleRatio,
    scale: nextScale,
  };
}
