import React, { useState } from 'react';
import { Play, Download, Music, Check } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';

interface PremiumProps {
  onRequireAuth: () => void;
}

const PLANS = [
  {
    id: 'individual',
    name: 'Individual',
    audience: 'For solo viewers',
    price: '$11.99',
    cadence: 'per month',
    summary: 'Ad-free playback, offline downloads, and Music Premium on one account.',
  },
  {
    id: 'family',
    name: 'Family',
    audience: 'For households up to 5',
    price: '$19.99',
    cadence: 'per month',
    summary: 'Share Premium perks across up to five family members with private libraries.',
  },
  {
    id: 'annual',
    name: 'Annual',
    audience: 'For year-round creators & viewers',
    price: '$119.00',
    cadence: 'per year',
    summary: 'All Individual benefits with two months included at an annual rate.',
  },
];

export function Premium({ onRequireAuth }: PremiumProps) {
  const { user, authFetch, updateUser } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState('individual');
  const [activating, setActivating] = useState(false);

  const handleActivate = async () => {
    if (!user) {
      onRequireAuth();
      return;
    }
    setActivating(true);
    try {
      const res = await authFetch('/api/premium/activate', { method: 'POST' });
      if (res.ok) {
        updateUser({ isPremium: true });
      }
    } finally {
      setActivating(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-12 px-4 sm:px-6">
      <div className="flex flex-col items-center text-center">
        <div className="w-14 h-14 bg-red-600 text-white rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-red-600/20">
          <Play className="w-7 h-7 fill-current ml-0.5" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 text-balance">
          Osei TV Premium
        </h1>
        <p className="text-base sm:text-lg text-slate-600 mt-3 max-w-xl">
          Watch every broadcast uninterrupted, save videos for offline travel, and stream lossless studio audio.
        </p>

        {user?.isPremium ? (
          <div className="mt-7 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-semibold">
            <Check className="w-4 h-4" />
            Your Osei TV Premium membership is active
          </div>
        ) : (
          <button
            type="button"
            onClick={handleActivate}
            disabled={activating}
            className="mt-7 px-7 py-3 bg-slate-900 text-white rounded-lg text-sm font-semibold hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            {activating ? 'Activating...' : 'Start 1-Month Free Trial'}
          </button>
        )}
      </div>

      {/* Plan Selection */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-12">
        {PLANS.map((plan) => {
          const isSelected = selectedPlan === plan.id;
          return (
            <button
              key={plan.id}
              type="button"
              onClick={() => setSelectedPlan(plan.id)}
              className={`text-left p-6 rounded-2xl border transition-colors ${
                isSelected
                  ? 'border-slate-900 bg-slate-50'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="text-xs font-medium text-slate-500">{plan.audience}</div>
              <div className="text-lg font-bold text-slate-900 mt-1">{plan.name}</div>
              <div className="mt-3 flex items-baseline gap-1.5">
                <span className="text-2xl font-extrabold text-slate-900 tabular-nums">
                  {plan.price}
                </span>
                <span className="text-xs text-slate-500">{plan.cadence}</span>
              </div>
              <p className="text-sm text-slate-600 mt-3 leading-relaxed">{plan.summary}</p>
            </button>
          );
        })}
      </div>

      {/* Included Benefits */}
      <div className="grid md:grid-cols-3 gap-8 mt-14 pt-12 border-t border-slate-200">
        <div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
            <Play className="w-5 h-5 text-slate-900" />
          </div>
          <h3 className="text-base font-bold text-slate-900 mb-1.5">Ad-free & background</h3>
          <p className="text-sm text-slate-600 leading-relaxed">
            Watch videos and live replays without interruptions, even when multitasking or with your screen locked.
          </p>
        </div>

        <div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
            <Download className="w-5 h-5 text-slate-900" />
          </div>
          <h3 className="text-base font-bold text-slate-900 mb-1.5">Offline downloads</h3>
          <p className="text-sm text-slate-600 leading-relaxed">
            Save high-definition videos locally before flights, commutes, or low-connectivity travel.
          </p>
        </div>

        <div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
            <Music className="w-5 h-5 text-slate-900" />
          </div>
          <h3 className="text-base font-bold text-slate-900 mb-1.5">Music Premium</h3>
          <p className="text-sm text-slate-600 leading-relaxed">
            Stream curated sets, acoustic sessions, and studio mixes uninterrupted alongside your video membership.
          </p>
        </div>
      </div>
    </div>
  );
}
