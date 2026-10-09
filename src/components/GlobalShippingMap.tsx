import React from 'react';
import { Plane, MapPin, CheckCircle2, Package } from 'lucide-react';

interface GlobalShippingMapProps {
  trackingNumber: string;
  originFacility: string;
  currentLocation: string;
  destinationCity: string;
  destinationCountry: string;
  status: string;
  dataSourceMode: string;
  estimatedDelivery: string;
}

const STAGES = [
  'Order Received',
  'Preparing Shipment',
  'Origin Facility',
  'International Transit',
  'Customs Processing',
  'Out for Delivery',
  'Delivered',
];

export const GlobalShippingMap: React.FC<GlobalShippingMapProps> = ({
  trackingNumber,
  originFacility,
  currentLocation,
  destinationCity,
  destinationCountry,
  status,
  dataSourceMode,
  estimatedDelivery,
}) => {
  const currentIdx = Math.max(
    0,
    STAGES.findIndex((s) => s.toLowerCase() === status.toLowerCase())
  );
  const progressPct = Math.min(100, Math.max(15, Math.round(((currentIdx + 1) / STAGES.length) * 100)));

  return (
    <div className="rounded-xl border border-white/10 bg-[#12141C] p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>Galatasaray Global Logistics Corridor</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono text-[#FDB912]">{trackingNumber}</span>
            <span aria-hidden="true">·</span>
            <span>Source: {dataSourceMode}</span>
          </div>
          <h3 className="mt-1 text-lg font-semibold text-white">
            {originFacility} → {destinationCity}, {destinationCountry}
          </h3>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-400">Estimated Delivery</p>
          <p className="text-sm font-mono font-semibold text-[#FDB912] tabular-nums">{estimatedDelivery}</p>
        </div>
      </div>

      {/* Interactive SVG Corridor Map */}
      <div className="relative h-64 w-full overflow-hidden rounded-lg border border-white/10 bg-[#0B0C10] p-4">
        <svg
          viewBox="0 0 800 240"
          className="h-full w-full"
          role="img"
          aria-label="Global Air Logistics Route Visualization"
        >
          <defs>
            <linearGradient id="routeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#A90432" />
              <stop offset="50%" stopColor="#FDB912" />
              <stop offset="100%" stopColor="#16A34A" />
            </linearGradient>
          </defs>

          {/* Subtle Latitude/Longitude Reference Grid */}
          <g stroke="rgba(255,255,255,0.05)" strokeWidth="1">
            <line x1="0" y1="60" x2="800" y2="60" />
            <line x1="0" y1="120" x2="800" y2="120" />
            <line x1="0" y1="180" x2="800" y2="180" />
            <line x1="160" y1="0" x2="160" y2="240" />
            <line x1="320" y1="0" x2="320" y2="240" />
            <line x1="480" y1="0" x2="480" y2="240" />
            <line x1="640" y1="0" x2="640" y2="240" />
          </g>

          {/* Curved Flight Arc from Istanbul Hub (120, 170) -> European Transit Hub (400, 75) -> Destination (680, 130) */}
          <path
            d="M 120 170 Q 400 20 680 130"
            fill="none"
            stroke="rgba(255,255,255,0.16)"
            strokeWidth="2"
            strokeDasharray="6 6"
          />
          <path
            d="M 120 170 Q 400 20 680 130"
            fill="none"
            stroke="url(#routeGradient)"
            strokeWidth="3"
            strokeDasharray="650"
            strokeDashoffset={Math.round(650 - (650 * progressPct) / 100)}
          />

          {/* Origin Hub Node: Istanbul */}
          <g transform="translate(120, 170)">
            <circle r="7" fill="#A90432" stroke="#FFFFFF" strokeWidth="2" />
            <text x="-40" y="24" fill="#94A3B8" fontSize="11" fontFamily="JetBrains Mono">
              IST HUB (Origin)
            </text>
          </g>

          {/* Active Waypoint Node */}
          <g transform="translate(400, 92)">
            <circle r="9" fill="#FDB912" />
            <text x="-75" y="-16" fill="#FDB912" fontSize="11" fontWeight="600" fontFamily="JetBrains Mono">
              {status.toUpperCase()}
            </text>
            <text x="-85" y="26" fill="#E2E8F0" fontSize="11" fontFamily="Plus Jakarta Sans">
              {currentLocation.slice(0, 34)}
            </text>
          </g>

          {/* Destination Node */}
          <g transform="translate(680, 130)">
            <circle r="7" fill="#16A34A" stroke="#FFFFFF" strokeWidth="2" />
            <text x="-55" y="24" fill="#94A3B8" fontSize="11" fontFamily="JetBrains Mono">
              {destinationCity.toUpperCase()}
            </text>
          </g>
        </svg>

        <div className="absolute bottom-3 left-4 right-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded border border-white/10">
          <span className="flex items-center gap-1.5">
            <Plane className="w-3.5 h-3.5 text-[#FDB912]" />
            <span>Active Stage: {status}</span>
          </span>
          <span className="font-mono tabular-nums">Corridor Completion: {progressPct}%</span>
        </div>
      </div>

      {/* Graphical 7-Stage Milestone Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 pt-2">
        {STAGES.map((stageName, index) => {
          const isCompleted = index <= currentIdx;
          const isCurrent = index === currentIdx;
          return (
            <div
              key={stageName}
              className={`rounded-lg border p-2.5 text-left transition-colors ${
                isCurrent
                  ? 'border-[#FDB912] bg-[#FDB912]/10 text-white'
                  : isCompleted
                  ? 'border-emerald-500/30 bg-emerald-950/20 text-slate-200'
                  : 'border-white/10 bg-[#0B0C10] text-slate-500'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono tabular-nums">0{index + 1}</span>
                {isCompleted ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#FDB912]" />
                ) : (
                  <Package className="w-3.5 h-3.5 text-slate-600" />
                )}
              </div>
              <p className="mt-1.5 text-xs font-medium leading-snug">{stageName}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
