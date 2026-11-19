import { CHART_GEOMETRY } from '../config/uiConstants.js';

/**
 * Converts a numeric series into SVG polyline coordinates inside shared chart plot bounds.
 *
 * @param items - Ordered data points.
 * @param accessor - Numeric extractor for Y value.
 * @param maxValue - Axis ceiling value.
 * @returns Space-separated "x,y" SVG coordinate pairs.
 */
export function buildChartPolyline<T>(
  items: readonly T[],
  accessor: (item: T) => number,
  maxValue: number,
): string {
  const plotW = CHART_GEOMETRY.WIDTH - CHART_GEOMETRY.PAD_LEFT - CHART_GEOMETRY.PAD_RIGHT;
  const plotH = CHART_GEOMETRY.HEIGHT - CHART_GEOMETRY.PAD_TOP - CHART_GEOMETRY.PAD_BOTTOM;
  const stepX = items.length > 1 ? plotW / (items.length - 1) : plotW;

  return items
    .map((item, idx) => {
      const x = Math.round(CHART_GEOMETRY.PAD_LEFT + idx * stepX);
      const ratio = Math.min(1, accessor(item) / Math.max(1, maxValue));
      const y = Math.round(CHART_GEOMETRY.PAD_TOP + (1 - ratio) * plotH);
      return `${String(x)},${String(y)}`;
    })
    .join(' ');
}

/**
 * Builds a closed SVG polygon string for an area fill under a chart polyline.
 */
export function buildChartAreaPolygon<T>(
  items: readonly T[],
  accessor: (item: T) => number,
  maxValue: number,
): string {
  if (items.length === 0) {
    return '';
  }
  const linePoints = buildChartPolyline(items, accessor, maxValue);
  const baseLineY = CHART_GEOMETRY.HEIGHT - CHART_GEOMETRY.PAD_BOTTOM;
  const startX = CHART_GEOMETRY.PAD_LEFT;
  const endX = CHART_GEOMETRY.WIDTH - CHART_GEOMETRY.PAD_RIGHT;
  return `${String(startX)},${String(baseLineY)} ${linePoints} ${String(endX)},${String(baseLineY)}`;
}

/**
 * Finds the upper Y-axis bound across items, respecting a minimum floor.
 */
export function resolveSeriesMax<T>(
  items: readonly T[],
  accessor: (item: T) => number,
  floor: number,
): number {
  let maxVal = floor;
  for (const item of items) {
    const val = accessor(item);
    if (val > maxVal) {
      maxVal = val;
    }
  }
  return maxVal;
}
