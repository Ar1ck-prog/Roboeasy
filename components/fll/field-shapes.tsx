/**
 * SVG pieces of the schematic field, drawn from season data only (no official
 * artwork). Everything inside <FieldFrame> uses field coordinates: mm, y up.
 */

import type { ReactNode } from 'react'

import { actionZoneFrame, actionZonePolygon, missionOutline, svgPoints, zonePolygon } from '@/lib/fll/geometry'
import { missionHeading } from '@/lib/fll/path'
import type { LaunchArea, Mission, Point, Zone } from '@/lib/fll/season'

/** Flips y so children can use field coordinates (origin bottom-left, y up). */
export function FieldFrame({ height, children }: { height: number; children: ReactNode }) {
  return <g transform={`matrix(1 0 0 -1 0 ${height})`}>{children}</g>
}

/** Text drawn upright inside a flipped frame. */
export function Label({ at, children, className, size = 34 }: { at: Point; children: ReactNode; className?: string; size?: number }) {
  return (
    <text className={className} transform={`translate(${at.x} ${at.y}) scale(1 -1)`} fontSize={size} textAnchor="middle" dominantBaseline="central">
      {children}
    </text>
  )
}

/** Mat, optional user background, grid. Must be outside <FieldFrame>. */
export function MatBase({
  width,
  height,
  background,
  backgroundOpacity = 1,
  grid = 100,
  unit = 'mm',
}: {
  width: number
  height: number
  background?: string | null
  backgroundOpacity?: number
  grid?: number
  unit?: string
}) {
  const id = `fll-grid-${grid}`
  return (
    <>
      <defs>
        <pattern id={id} width={grid || 1} height={grid || 1} patternUnits="userSpaceOnUse" y={grid > 0 ? height % grid : 0}>
          <path d={`M${grid} 0H0V${grid}`} fill="none" stroke="currentColor" strokeOpacity="0.1" strokeWidth={Math.max(1, grid / 60)} />
        </pattern>
        <pattern id="fll-hatch" width="40" height="40" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <path d="M0 0V40" stroke="currentColor" strokeWidth="10" />
        </pattern>
      </defs>
      <rect className="fll-mat" x="0" y="0" width={width} height={height} rx="12" />
      {background && <image href={background} x="0" y="0" width={width} height={height} preserveAspectRatio="none" opacity={backgroundOpacity} />}
      {grid > 0 && <rect x="0" y="0" width={width} height={height} fill={`url(#${id})`} pointerEvents="none" />}
      <MatScale width={width} height={height} unit={unit} />
    </>
  )
}

/** Millimetre ticks along the bottom and left edges (origin = bottom-left corner). */
function MatScale({ width, height, unit }: { width: number; height: number; unit: string }) {
  const step = 250
  const xs = Array.from({ length: Math.floor(width / step) + 1 }, (_, i) => i * step)
  const ys = Array.from({ length: Math.floor(height / step) + 1 }, (_, i) => i * step)
  return (
    <g className="fll-scale" aria-hidden="true" pointerEvents="none">
      {xs.map((x) => (
        <g key={`x${x}`}>
          <line x1={x} y1={height} x2={x} y2={height - (x % 500 ? 18 : 34)} />
          {x % 500 === 0 && x > 0 && x < width - 100 && (
            <text x={x} y={height - 44} textAnchor="middle">
              {x}
            </text>
          )}
        </g>
      ))}
      {ys.map((y) => (
        <g key={`y${y}`}>
          <line x1={0} y1={height - y} x2={y % 500 ? 18 : 34} y2={height - y} />
          {y % 500 === 0 && y > 0 && y < height - 60 && (
            <text x={44} y={height - y} dominantBaseline="central">
              {y}
            </text>
          )}
        </g>
      ))}
      <text x={width - 16} y={height - 44} textAnchor="end">
        {width} {unit}
      </text>
      <text x={44} y={36} dominantBaseline="central">
        {height}
      </text>
    </g>
  )
}

export function LaunchAreaShape({ area, label }: { area: LaunchArea; label: string }) {
  const r = 34
  const rad = (area.start.headingDeg * Math.PI) / 180
  return (
    <g className="fll-area">
      <polygon points={svgPoints(zonePolygon(area))} />
      <circle className="fll-start" cx={area.start.x} cy={area.start.y} r={r * 0.5} />
      <line
        className="fll-start"
        x1={area.start.x}
        y1={area.start.y}
        x2={area.start.x + Math.cos(rad) * r * 2}
        y2={area.start.y + Math.sin(rad) * r * 2}
        markerEnd="url(#fll-arrow)"
      />
      {label && (
        <Label at={{ x: area.x, y: area.y + 60 }} className="fll-area-label">
          {label}
        </Label>
      )}
    </g>
  )
}

export function ForbiddenShape({ zone, label }: { zone: Zone; label?: string }) {
  return (
    <g className="fll-forbidden">
      <polygon points={svgPoints(zonePolygon(zone))} />
      {label && (
        <Label at={zone} size={28}>
          {label}
        </Label>
      )}
    </g>
  )
}

/** Where the robot stands during the action (dashed) and which way it faces. */
export function MissionZone({ mission }: { mission: Mission }) {
  const zone = actionZoneFrame(mission)
  const heading = (missionHeading(mission) * Math.PI) / 180
  const reach = 70
  return (
    <g className="fll-zone">
      <polygon points={svgPoints(actionZonePolygon(mission))} />
      <line x1={zone.x} y1={zone.y} x2={zone.x + Math.cos(heading) * reach} y2={zone.y + Math.sin(heading) * reach} markerEnd="url(#fll-arrow)" />
    </g>
  )
}

/** Mission model outline with its number, optionally with the action zone. */
export function MissionShape({ mission, showZone = true }: { mission: Mission; showZone?: boolean }) {
  return (
    <>
      {showZone && <MissionZone mission={mission} />}
      <polygon className="fll-outline" points={svgPoints(missionOutline(mission))} />
      <circle className="fll-badge" cx={mission.x} cy={mission.y} r={30} />
      <Label at={mission} className="fll-badge-text" size={32}>
        {mission.number}
      </Label>
    </>
  )
}

export function ArrowMarker() {
  return (
    <marker id="fll-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
      <path d="M0 0L10 5L0 10z" fill="currentColor" />
    </marker>
  )
}
