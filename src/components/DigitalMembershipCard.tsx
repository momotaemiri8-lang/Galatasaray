import React from 'react';
import { QrCode, ShieldCheck, Globe } from 'lucide-react';

interface DigitalMembershipCardProps {
  memberName: string;
  tier: string;
  memberNumber: string;
  expiryDate: string;
  status: string;
  onVerifyClick?: (memberNumber: string) => void;
}

export const DigitalMembershipCard: React.FC<DigitalMembershipCardProps> = ({
  memberName,
  tier,
  memberNumber,
  expiryDate,
  status,
  onVerifyClick,
}) => {
  const isPlatinum = tier === 'PLATINUM';
  const isGold = tier === 'GOLD';

  return (
    <div
      className={`relative overflow-hidden rounded-xl border p-6 transition-transform duration-200 ${
        isPlatinum
          ? 'bg-gradient-to-br from-[#181A20] via-[#0B0C10] to-[#2B0912] border-[#FDB912]/60'
          : isGold
          ? 'bg-gradient-to-br from-[#2B0912] via-[#12141C] to-[#1F1708] border-[#FDB912]/40'
          : 'bg-[#12141C] border-white/15'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <img
            src="/src/assets/images/galatasaray_logo.png"
            alt="Galatasaray SK Official Emblem"
            className="w-12 h-12 rounded-xl object-contain bg-black/40 p-1 border border-[#FDB912]/30 shrink-0"
          />
          <div>
            <p className="text-xs font-medium tracking-wider text-[#FDB912] uppercase">
              Galatasaray SK · Global Sovereign Pass
            </p>
            <h4 className="mt-1 text-xl font-bold tracking-tight text-white font-display">
              {tier === 'NONE' ? 'UNREGISTERED PASS' : `${tier} LION MEMBER`}
            </h4>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-mono text-slate-300">
          <ShieldCheck className="w-4 h-4 text-[#FDB912]" />
          <span>{status || 'Active'}</span>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 border-t border-white/10 pt-4">
        <div>
          <p className="text-xs text-slate-400">Cardholder Name</p>
          <p className="mt-0.5 text-sm font-semibold text-white truncate">{memberName}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">Credential ID</p>
          <p className="mt-0.5 text-xs font-mono text-[#FDB912] tabular-nums">
            {memberNumber || 'GS-1905-PENDING'}
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4">
        <div className="space-y-1">
          <p className="text-xs text-slate-400">
            Valid Thru · <span className="font-mono text-slate-200 tabular-nums">{expiryDate || '2027-10-09'}</span>
          </p>
          <p className="text-xs text-slate-400 flex items-center gap-1">
            <Globe className="w-3.5 h-3.5 text-slate-400" />
            <span>RAMS Park & Global Priority Access</span>
          </p>
        </div>

        <button
          type="button"
          onClick={() => memberNumber && onVerifyClick && onVerifyClick(memberNumber)}
          className="group flex items-center gap-2 rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-xs font-medium text-white hover:border-[#FDB912] transition-colors"
          title="Verify QR Credential Server-Side"
        >
          <QrCode className="w-6 h-6 text-[#FDB912]" />
          <span className="whitespace-nowrap">Verify QR</span>
        </button>
      </div>
    </div>
  );
};
