import { useState } from 'react';
import { useIsMutating, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { getErrorMessage } from '@/lib/get-error-message';
import type { Term } from '@/features/terms/types';
import { fetchPolicy, PERIODS, savePolicy, type DroppingPolicy } from './api';

export function DroppingPolicyDialog({ term, onClose }: { term: Term | null; onClose: () => void }) {
  const busy = useIsMutating({ mutationKey: ['dropping-policy-save', term?.id] }) > 0;
  return <Dialog open={!!term} onOpenChange={open => { if (!open && !busy) onClose(); }}><DialogContent showCloseButton={!busy} className="w-[calc(100%-2rem)] max-h-[90dvh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Dropping policy · {term?.schoolYear}</DialogTitle><DialogDescription>Set the dates used to calculate SHS dropping charges.</DialogDescription></DialogHeader>{term && <PolicyLoader key={term.id} term={term} onClose={onClose} />}</DialogContent></Dialog>;
}
function PolicyLoader({ term, onClose }: { term: Term; onClose: () => void }) {
  const query = useQuery({ queryKey: ['dropping-policy', term.id], queryFn: () => fetchPolicy(term.id) });
  if (query.isPending) return <p role="status">Loading policy…</p>;
  if (query.isError) return <div className="space-y-3"><p role="alert" className="text-sm text-destructive">{getErrorMessage(query.error)}</p><Button onClick={() => query.refetch()}>Try again</Button></div>;
  return <PolicyForm term={term} initial={query.data} onClose={onClose} />;
}
function PolicyForm({ term, initial, onClose }: { term: Term; initial: DroppingPolicy | null; onClose: () => void }) {
  const cache = useQueryClient();
  const [enabled, setEnabled] = useState(initial?.enabled ?? false);
  const [periods, setPeriods] = useState<DroppingPolicy['periods']>(() => Object.fromEntries(PERIODS.map(p => [p.key, initial?.periods?.[p.key] ?? { startsOn: '', endsOn: '' }])) as DroppingPolicy['periods']);
  const save = useMutation({ mutationKey: ['dropping-policy-save', term.id], mutationFn: () => savePolicy(term.id, { enabled, periods }), onSuccess: () => { void cache.invalidateQueries({ queryKey: ['dropping-policy'] }); void cache.invalidateQueries({ queryKey: ['dropping-assessment'] }); onClose(); } });
  const complete = PERIODS.every(p => periods[p.key].startsOn && periods[p.key].endsOn);
  return <form className="space-y-5" onSubmit={e => { e.preventDefault(); save.mutate(); }}>
    <p className="text-sm text-muted-foreground">Use consecutive periods covering {term.startDate ?? 'the school-year start'} through {term.endDate ?? 'the school-year end'}. Registration may start earlier. Installment dates are separate.</p>
    <div className="divide-y">{PERIODS.map(p => <section key={p.key} className="space-y-3 py-4 first:pt-0"><h3 className="text-sm font-semibold">{p.label}</h3><div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><Label htmlFor={`${p.key}-start`}>From</Label><Input id={`${p.key}-start`} type="date" required disabled={save.isPending} value={periods[p.key].startsOn} onChange={e => setPeriods({ ...periods, [p.key]: { ...periods[p.key], startsOn: e.target.value } })} /></div><div className="space-y-1.5"><Label htmlFor={`${p.key}-end`}>Through</Label><Input id={`${p.key}-end`} type="date" required disabled={save.isPending} min={periods[p.key].startsOn} value={periods[p.key].endsOn} onChange={e => setPeriods({ ...periods, [p.key]: { ...periods[p.key], endsOn: e.target.value } })} /></div></div><dl className="grid gap-1 text-xs text-muted-foreground"><div><dt className="inline font-medium">Paying: </dt><dd className="inline">{p.paying}</dd></div><div><dt className="inline font-medium">Voucher / ESC: </dt><dd className="inline">{p.voucher}</dd></div></dl></section>)}</div>
    <label className="flex items-start gap-3 text-sm"><Checkbox checked={enabled} disabled={save.isPending} onCheckedChange={value => setEnabled(value === true)} /><span>Enable for new dropping approvals</span></label>
    <p className="text-xs text-muted-foreground">Each save creates a policy version. Previously approved charges stay unchanged. Fee classifications and student categories must also be complete.</p>
    {save.isError && <p role="alert" className="text-sm text-destructive">{getErrorMessage(save.error)}</p>}
    <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={save.isPending} onClick={onClose}>Cancel</Button><Button disabled={!complete || save.isPending}>{save.isPending ? 'Saving…' : 'Save policy'}</Button></div>
  </form>;
}
