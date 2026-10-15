import { useState } from 'react';
import { CopyIcon, CreditCardIcon, DownloadIcon, Loader2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { downloadPaymentChannelQr } from '@/features/payment-channels/api';
import type { PaymentChannel } from '@/features/payment-channels/types';
import { cn } from '@/lib/utils';

function saveImage(url: string, name: string) {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

function AccountValue({ label, value, disabled }: { label: string; value: string; disabled: boolean }) {
  const [feedback, setFeedback] = useState('');
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setFeedback(`${label} copied.`);
    } catch {
      setFeedback('Couldn’t copy. Select the account details and copy them manually.');
    }
  }
  return <div className="space-y-1 py-4 first:pt-0 last:pb-0">
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0 space-y-1.5"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="select-text break-words text-sm font-semibold leading-relaxed tabular-nums [overflow-wrap:anywhere]">{value}</dd></div>
      <Button type="button" variant="outline" size="icon-sm" className="shadow-none" disabled={disabled} onClick={() => void copy()} aria-label={`Copy ${label.toLowerCase()}`}><CopyIcon aria-hidden="true" /></Button>
    </div>
    <p role="status" className={feedback ? 'text-xs text-muted-foreground' : 'sr-only'}>{feedback}</p>
  </div>;
}

export function PaymentAccountDetails({ channel, disabled, onRetry }: { channel: PaymentChannel; disabled: boolean; onRetry: () => void }) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [qrFailed, setQrFailed] = useState(false);
  const hasAccountDetails = !!(channel.accountName || channel.accountNumber);
  async function saveQr() {
    setSaving(true);
    setMessage('');
    try {
      const blob = await downloadPaymentChannelQr(channel.id);
      const url = URL.createObjectURL(blob);
      saveImage(url, `${channel.code}-payment-qr.${blob.type === 'image/jpeg' ? 'jpg' : 'png'}`);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage('QR downloaded.');
    } catch {
      setMessage('Couldn’t download the QR. Please try again.');
    } finally { setSaving(false); }
  }
  return <div className="space-y-4">
    <h3 className="sr-only">{channel.label} account details</h3>
    <div className={cn('grid overflow-hidden rounded-xl border', channel.qrUrl && hasAccountDetails && 'sm:grid-cols-[13rem_minmax(0,1fr)]')}>
      {channel.qrUrl && <div className="grid content-start justify-items-center gap-3 bg-white p-4">
        {qrFailed ? <div className="flex min-h-44 flex-col items-center justify-center gap-3 text-sm text-slate-900"><p role="alert">Couldn’t load the QR.</p><Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => { setQrFailed(false); onRetry(); }}>Reload QR</Button></div> : <img src={channel.qrUrl} alt={`${channel.label} payment QR`} className="size-44 max-w-full object-contain" onError={() => setQrFailed(true)} />}
        <Button type="button" variant="outline" size="sm" className="shadow-none" disabled={disabled || saving} onClick={() => void saveQr()}>{saving ? <Loader2Icon className="animate-spin" aria-hidden="true" /> : <DownloadIcon aria-hidden="true" />}{saving ? 'Saving…' : 'Save QR'}</Button>
      </div>}
      {hasAccountDetails && <div className={cn('min-w-0 bg-muted/35 p-4 sm:p-5', channel.qrUrl && 'border-t sm:border-t-0 sm:border-l')}>
        <dl className="divide-y">
          {channel.accountName && <AccountValue label={channel.code === 'bank' ? 'Bank name' : 'Account name'} value={channel.accountName} disabled={disabled} />}
          {channel.accountNumber && <AccountValue label={channel.code === 'bank' ? 'Account number' : 'Mobile number'} value={channel.accountNumber} disabled={disabled} />}
        </dl>
      </div>}
    </div>
    <p role="status" className={message ? 'text-xs text-muted-foreground' : 'sr-only'}>{message}</p>
  </div>;
}

export function PaymentChannelState({ loading, failed, empty, retrying, onRetry }: { loading: boolean; failed: boolean; empty: boolean; retrying: boolean; onRetry: () => void }) {
  if (loading) return <p role="status" className="flex items-center gap-2 py-3 text-sm text-muted-foreground"><Loader2Icon className="size-4 animate-spin" aria-hidden="true" />Loading payment methods…</p>;
  if (failed) return <div className="space-y-2 py-3"><p role="alert" className="text-sm">Couldn’t load payment methods. Please try again.</p><Button type="button" variant="outline" size="sm" disabled={retrying} onClick={onRetry}>{retrying ? 'Retrying…' : 'Retry'}</Button></div>;
  if (empty) return <p role="status" className="py-3 text-sm text-muted-foreground">No online payment methods are available. Contact the cashier for payment instructions.</p>;
  return null;
}

// Expanding account details never changes the recorded method; selection is explicit.
export function PaymentMethodsGuide({ channels, initialMethod = '', onRetry, onSelect, disabled = false }: {
  channels: PaymentChannel[]; initialMethod?: string; onRetry: () => void;
  onSelect?: (method: string) => void; disabled?: boolean;
}) {
  const [viewedMethod, setViewedMethod] = useState(() => channels.find(channel => channel.code === initialMethod)?.code ?? channels[0]?.code ?? '');
  const activeMethod = viewedMethod === '' ? '' : channels.find(channel => channel.code === viewedMethod)?.code ?? channels[0]?.code ?? '';
  if (!channels.length) return null;

  const accordion = <Accordion type="single" collapsible value={activeMethod} onValueChange={setViewedMethod}>
    {channels.map(channel => <AccordionItem key={channel.id} value={channel.code}>
      <div className={cn(onSelect && 'grid grid-cols-[1rem_minmax(0,1fr)] items-center gap-3')}>
        {onSelect && <RadioGroupItem value={channel.code} aria-label={channel.label} disabled={disabled}
          className="data-[state=checked]:border-primary data-[state=checked]:bg-primary" />}
        <AccordionTrigger>{channel.label}</AccordionTrigger>
      </div>
      <AccordionContent>
        <PaymentAccountDetails key={`${channel.id}-${channel.qrUrl}`} channel={channel} disabled={disabled} onRetry={onRetry} />
      </AccordionContent>
    </AccordionItem>)}
  </Accordion>;

  return onSelect ? <RadioGroup aria-label="Payment method" value={initialMethod} disabled={disabled} onValueChange={method => {
    setViewedMethod(method);
    onSelect(method);
  }}>{accordion}</RadioGroup> : accordion;
}

type PaymentMethodsProps = {
  channels: PaymentChannel[]; initialMethod: string; disabled: boolean;
  loading: boolean; failed: boolean; retrying: boolean; onRetry: () => void;
};

function PaymentMethodsContent({ channels, initialMethod, disabled, loading, failed, retrying, onRetry, onSelect, onConfirm }: PaymentMethodsProps & {
  onSelect?: (method: string) => void; onConfirm?: () => void;
}) {
  return <DialogContent className="flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-xl flex-col gap-0 overflow-hidden rounded-xl p-0 shadow-none">
      <DialogHeader className="shrink-0 border-b px-5 py-4 pr-12 text-left sm:px-6 sm:pr-12">
        <DialogTitle className="leading-snug">{onSelect ? 'Choose payment method' : 'Payment methods'}</DialogTitle>
        <DialogDescription>{onSelect ? 'Choose the method you used. Expand its name to view account details.' : 'Use these school accounts in your wallet or banking app.'}</DialogDescription>
      </DialogHeader>
      <div className="min-h-0 overflow-y-auto overscroll-contain p-5 sm:p-6">
        <PaymentChannelState loading={loading} failed={failed} empty={!channels.length} retrying={retrying} onRetry={onRetry} />
        {!loading && !failed && channels.length > 0 && <PaymentMethodsGuide channels={channels} initialMethod={initialMethod} onRetry={onRetry} onSelect={onSelect} disabled={disabled} />}
      </div>
      <footer className="flex shrink-0 justify-end gap-2 border-t px-5 py-4 sm:px-6">
        <DialogClose asChild><Button type="button" variant="outline">{onSelect ? 'Cancel' : 'Close'}</Button></DialogClose>
        {onConfirm && <Button type="button" onClick={onConfirm} disabled={disabled || loading || failed || !channels.some(channel => channel.code === initialMethod)}>Select</Button>}
      </footer>
    </DialogContent>;
}

export function PaymentMethodPicker({ id, invalid, describedBy, onChange, ...props }: PaymentMethodsProps & {
  id: string; invalid?: boolean; describedBy?: string; onChange: (method: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draftMethod, setDraftMethod] = useState(props.initialMethod);
  const selectedChannel = props.channels.find(channel => channel.code === props.initialMethod);
  function changeOpen(next: boolean) {
    if (next) setDraftMethod(props.initialMethod);
    setOpen(next);
  }
  function confirmMethod() {
    if (props.disabled || props.loading || props.failed || !props.channels.some(channel => channel.code === draftMethod)) return;
    onChange(draftMethod);
    setOpen(false);
  }

  return <Dialog open={open} onOpenChange={changeOpen}>
    <DialogTrigger asChild>
      <Button type="button" id={id} data-payment-field="method" variant="outline" disabled={props.disabled}
        className="w-full min-w-0 justify-start gap-2 font-normal" aria-invalid={invalid} aria-describedby={describedBy}
        aria-label={`Payment method (required), ${selectedChannel?.label ?? 'choose a method'}`}>
        <CreditCardIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className={cn('truncate', !selectedChannel && 'text-muted-foreground')}>{selectedChannel?.label ?? 'Choose method'}</span>
      </Button>
    </DialogTrigger>
    <PaymentMethodsContent {...props} initialMethod={draftMethod} onSelect={setDraftMethod} onConfirm={confirmMethod} />
  </Dialog>;
}
