import type { Ref } from 'react';
import { CheckIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export function ReturnSubmitted({ titleRef, onDone }: {
  titleRef?: Ref<HTMLHeadingElement>; onDone: () => void;
}) {
  return <div className="px-6 pb-6 pt-8">
    <DialogHeader className="items-center gap-0 text-center sm:text-center">
      <div className="mb-5 flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary" aria-hidden="true"><CheckIcon className="size-7" strokeWidth={2.5} /></div>
      <DialogTitle ref={titleRef} tabIndex={-1} className="text-xl leading-snug outline-none">Re-enrollment submitted</DialogTitle>
      <DialogDescription className="mt-2 leading-relaxed">View your status in My Program.</DialogDescription>
    </DialogHeader>
    <div className="mt-6 flex flex-wrap justify-end gap-2">
      <Button onClick={onDone}>Done</Button>
    </div>
  </div>;
}
