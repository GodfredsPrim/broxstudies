import React, { useState, useEffect } from 'react';
import { Trophy, Clock, Zap, FileText, ChevronRight, Gift, Calendar, Rocket } from 'lucide-react';
import { publicAPI, type Competition } from '../services/api';
import { Button, buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { SectionHeader } from '@/components/ui/section';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';

export const CompetitionPortal: React.FC = () => {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [loading, setLoading] = useState(true);
  const [registeringId, setRegisteringId] = useState<number | null>(null);

  const fetchCompetitions = async () => {
    try {
      const data = await publicAPI.listCompetitions();
      setCompetitions(data);
    } catch (err) {
      console.error('Failed to fetch competitions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompetitions();
  }, []);

  const handleRegister = async (compId: number) => {
    setRegisteringId(compId);
    try {
      await publicAPI.registerForCompetition(compId);
      alert('Success! You are now registered for this competition. Keep an eye on the start date!');
      fetchCompetitions();
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Failed to register.');
    } finally {
      setRegisteringId(null);
    }
  };

  return (
    <div className="generator-shell">
      <SectionHeader
        eyebrow="Monthly Challenges"
        title="Compete, Learn, Win"
        description="Stay updated with the latest rewards, announcements, and competition details."
      />

      <div className="grid grid-cols-1 gap-6 sm:gap-8 md:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card
              key={i}
              className="flex flex-col overflow-hidden border-gh-chalk bg-gh-paper shadow-brand-sm dark:border-white/10 dark:bg-gh-night-raised"
            >
              <Skeleton shape="block" className="h-48 w-full rounded-none" />
              <div className="flex flex-1 flex-col gap-4 p-6">
                <Skeleton shape="title" className="h-6 w-3/4" />
                <Skeleton shape="text" />
                <Skeleton shape="text" className="w-5/6" />
                <div className="mt-auto space-y-3">
                  <Skeleton shape="card" className="h-20" />
                  <Skeleton shape="button" className="h-11 w-full" />
                </div>
              </div>
            </Card>
          ))
        ) : competitions.length === 0 ? (
          <div className="col-span-full">
            <EmptyState
              icon={<Calendar size={32} strokeWidth={1.75} />}
              title="No current announcements"
              description="Check back soon for new rewards and monthly challenges."
            />
          </div>
        ) : (
          competitions.map((comp) => {
            const isLive = !!comp.pdf_url;
            return (
              <Card
                key={comp.id}
                className="group flex flex-col overflow-hidden border border-gh-chalk bg-gh-paper shadow-brand-sm transition-all duration-300 ease-brand hover:-translate-y-1 hover:shadow-brand-lg dark:border-white/10 dark:bg-gh-night-raised"
              >
                <div className="relative">
                  <div className="absolute right-3 top-3 z-10 sm:right-4 sm:top-4">
                    {isLive ? (
                      <Badge variant="brass" size="md" className="gap-1">
                        <Rocket size={11} /> Live
                      </Badge>
                    ) : (
                      <Badge variant="blue" size="md" className="gap-1">
                        <Clock size={11} /> Pending
                      </Badge>
                    )}
                  </div>

                  {comp.image_url ? (
                    <div className="h-44 overflow-hidden sm:h-48">
                      <img
                        src={comp.image_url}
                        alt={comp.title}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-500 ease-brand group-hover:scale-105"
                      />
                    </div>
                  ) : (
                    <div className="flex h-44 items-center justify-center bg-gh-ink-blue-50 text-gh-ink-blue/40 dark:bg-white/5 dark:text-gh-gold-glow/40 sm:h-48">
                      <Trophy size={56} strokeWidth={1} />
                    </div>
                  )}
                </div>

                <div className="flex flex-1 flex-col p-5 sm:p-6">
                  <h3 className="mb-2 text-lg font-extrabold tracking-tight text-gh-ink transition-colors group-hover:text-gh-ink-blue dark:text-gh-cream dark:group-hover:text-gh-gold-glow sm:mb-3 sm:text-xl">
                    {comp.title}
                  </h3>
                  <p className="mb-5 line-clamp-3 text-sm leading-relaxed text-gh-ink-60 dark:text-gh-chalk sm:mb-6">
                    {comp.description}
                  </p>

                  <div className="mt-auto space-y-4">
                    <div className="rounded-xl border border-gh-chalk bg-gh-cream/60 p-3 transition-colors group-hover:border-gh-brass/30 group-hover:bg-gh-brass-50/60 dark:border-white/10 dark:bg-white/5 dark:group-hover:bg-gh-brass/10 sm:p-4">
                      <div className="mb-1 flex items-center gap-2">
                        <Gift size={14} className="text-gh-brass dark:text-gh-gold-glow" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-gh-ink-40 dark:text-gh-chalk">
                          Grand Prize
                        </span>
                      </div>
                      <div className="text-xl font-black text-gh-brass-600 dark:text-gh-gold-glow sm:text-2xl">
                        {comp.prize}
                      </div>
                      <div className="mt-3 flex items-center justify-between border-t border-gh-chalk/60 pt-3 dark:border-white/10">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-gh-ink-60 dark:text-gh-chalk">
                          <Calendar size={13} />
                          {new Date(comp.start_date).toLocaleDateString()}
                        </div>
                        <ChevronRight
                          size={14}
                          className="text-gh-ink-40 transition-transform duration-300 ease-brand group-hover:translate-x-1 group-hover:text-gh-ink-blue dark:text-gh-chalk dark:group-hover:text-gh-gold-glow"
                        />
                      </div>
                    </div>

                    {isLive ? (
                      <div className="flex gap-2">
                        <a
                          href={comp.pdf_url!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={buttonVariants({ variant: 'outline' }) + ' flex-1 gap-2'}
                        >
                          <FileText size={14} /> Paper
                        </a>
                        <Button
                          onClick={() => handleRegister(comp.id)}
                          disabled={registeringId === comp.id}
                          size="default"
                          className="flex-[1.5] gap-2"
                        >
                          {registeringId === comp.id ? 'Registering…' : (<><Zap size={14} /> Register</>)}
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-gh-chalk bg-gh-cream/40 py-3 text-[11px] font-black uppercase tracking-widest text-gh-ink-40 dark:border-white/10 dark:bg-white/5 dark:text-gh-chalk">
                        <Clock size={14} /> Waiting for Paper Drop
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
};
