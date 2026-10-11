import { useState, type RefObject } from 'react';
import { Link } from 'react-router-dom';
import { XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList, ComboboxTrigger } from '@/components/ui/combobox';
import { feeCategoryLabel, feeYearLevelLabel, type SchoolYearFee } from '@/features/fees/types';
import { formatPeso } from '@/lib/money';
import type { DroppingCategory, FeeRule } from './api';

export function PolicyFeePicker({ portalContainer, category, selected, fees, disabled, onChange }: { portalContainer?: RefObject<HTMLDivElement | null>; category: DroppingCategory; selected: FeeRule[]; fees: SchoolYearFee[]; disabled?: boolean; onChange: (entries: FeeRule[]) => void }) {
  const [search, setSearch] = useState('');
  const selectedNames = selected.map(entry => fees.find(fee => fee.id === entry.feeId)?.name ?? entry.name ?? 'Unavailable fee');
  const summary = selectedNames.length === 1 ? selectedNames[0] : `${selectedNames.length} fees selected`;
  return <div className="space-y-3">
    <div className="space-y-2"><Label htmlFor="period-fees">Fees to charge</Label>
      <Combobox multiple items={fees} inputValue={search} onInputValueChange={setSearch} onOpenChange={open => { if (!open) setSearch(''); }} isItemEqualToValue={(fee, value) => fee.id === value.id} value={fees.filter(fee => selected.some(entry => entry.feeId === fee.id))} onValueChange={(items: SchoolYearFee[]) => onChange([...items.map(fee => selected.find(entry => entry.feeId === fee.id) ?? { feeId: fee.id, percent: 100, name: fee.name }), ...selected.filter(entry => !fees.some(fee => fee.id === entry.feeId))])} itemToStringLabel={(fee: SchoolYearFee) => fee.name} disabled={disabled || !fees.length}>
        <ComboboxTrigger id="period-fees" render={<Button type="button" variant="outline" />} className="w-full justify-between gap-3 font-normal" disabled={disabled || !fees.length}>
          <span className={`min-w-0 truncate ${selected.length ? '' : 'text-muted-foreground'}`}>{selected.length ? summary : 'Select fees'}</span>
        </ComboboxTrigger>
        <ComboboxContent portalContainer={portalContainer} initialFocus className="flex max-h-64 min-w-0 flex-col">
          <ComboboxInput aria-label="Search fees" placeholder="Search fees…" showTrigger={false} className="shrink-0" />
          <ComboboxEmpty className="px-3 py-6">No matching fees.</ComboboxEmpty>
          <ComboboxList className="min-h-0 flex-1">{(fee: SchoolYearFee) => <ComboboxItem key={fee.id} value={fee} className="py-2"><span className="min-w-0"><span className="block break-words">{fee.name}</span><span className="block text-xs text-muted-foreground">{feeCategoryLabel(fee.category)} · {feeYearLevelLabel(fee.yearLevel)} · {formatPeso(fee.amount)}</span></span></ComboboxItem>}</ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
    {!fees.length && <p className="text-sm text-muted-foreground">No fees for this school year. <Link to="/admin/fees" className="text-primary underline underline-offset-4">Add fees</Link></p>}
    {selected.length > 0 && <div className="divide-y border-y">{selected.map(entry => {
      const fee = fees.find(item => item.id === entry.feeId);
      const name = fee?.name ?? entry.name ?? 'Unavailable fee';
      return <div key={entry.feeId} className="flex items-center gap-2 py-3">
        <div className="min-w-0 flex-1"><p className="break-words text-sm font-medium">{name}</p>{fee ? <p className="text-xs text-muted-foreground">{feeCategoryLabel(fee.category)} · {feeYearLevelLabel(fee.yearLevel)}</p> : <p className="text-xs text-destructive">No longer available. Remove this fee.</p>}</div>
        <div className="relative w-20 shrink-0"><Input aria-label={`Percentage of ${name} for ${category === 'paying' ? 'Paying' : 'With voucher / ESC'}`} type="number" min={1} max={100} step={1} value={entry.percent || ''} onChange={event => onChange(selected.map(item => item.feeId === entry.feeId ? { ...item, percent: Number(event.target.value) } : item))} className="h-9 pr-7 text-right tabular-nums" /><span className="pointer-events-none absolute top-2 right-2.5 text-sm text-muted-foreground">%</span></div>
        <Button type="button" variant="ghost" size="icon" className="size-9 shrink-0 text-muted-foreground" aria-label={`Remove ${name}`} onClick={() => onChange(selected.filter(item => item.feeId !== entry.feeId))}><XIcon className="size-4" /></Button>
      </div>;
    })}</div>}
    <p className="text-xs text-muted-foreground">Charges use the selected percentage of each original billed fee.</p>
  </div>;
}
