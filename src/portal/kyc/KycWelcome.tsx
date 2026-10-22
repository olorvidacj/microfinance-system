import React from 'react';
import { ShieldCheck, IdCard, Camera, Clock, Sun, Lock } from 'lucide-react';

/** The first screen: why verification is needed, what to prepare, and how the data is protected. */
export const KycWelcome: React.FC<{ onStart: () => void; resuming: boolean }> = ({ onStart, resuming }) => (
  <div className="mx-auto max-w-xl overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
    <div className="bg-navy-950 px-6 pb-8 pt-7 text-white">
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gold-400 text-navy-950">
        <ShieldCheck className="h-7 w-7" aria-hidden="true" />
      </span>
      <h1 className="mt-4 text-2xl font-bold">Verify your identity</h1>
      <p className="mt-2 text-base text-slate-200">
        Verification protects your account and lets you apply for loans and open savings with HOSCOMCO. It takes about 10 minutes.
      </p>
    </div>
    <div className="space-y-5 px-6 py-6">
      <div>
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Have these ready</h2>
        <ul className="mt-3 space-y-3 text-base text-navy-950">
          <li className="flex gap-3">
            <IdCard className="h-6 w-6 shrink-0 text-gold-600" aria-hidden="true" /> One valid government ID, such as a PhilSys ID, UMID, driver's license or passport
          </li>
          <li className="flex gap-3">
            <Camera className="h-6 w-6 shrink-0 text-gold-600" aria-hidden="true" /> A phone or computer with a camera, for photos of your ID and a selfie
          </li>
          <li className="flex gap-3">
            <Sun className="h-6 w-6 shrink-0 text-gold-600" aria-hidden="true" /> A bright place, so the photos are clear
          </li>
          <li className="flex gap-3">
            <Clock className="h-6 w-6 shrink-0 text-gold-600" aria-hidden="true" /> Your progress is saved, so you can stop and come back later
          </li>
        </ul>
      </div>
      <p className="flex gap-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
        <Lock className="h-5 w-5 shrink-0 text-navy-900" aria-hidden="true" />
        Your information is protected under the Data Privacy Act (RA 10173). Only authorised branch staff see it, and a branch officer reviews every application before it
        is approved.
      </p>
      <button type="button" onClick={onStart} className="w-full rounded-2xl bg-gold-400 py-4 text-lg font-bold text-navy-950 hover:bg-gold-300 focus:outline-none focus-visible:ring-4 focus-visible:ring-gold-300">
        {resuming ? 'Continue where I left off' : 'Start verification'}
      </button>
    </div>
  </div>
);
