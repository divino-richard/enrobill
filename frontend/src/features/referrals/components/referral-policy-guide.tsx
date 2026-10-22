import { BookOpenIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function ReferralPolicyGuide({ disabled = false }: { disabled?: boolean }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button type="button" variant="ghost" className="min-h-11 text-primary" disabled={disabled}>
          <BookOpenIcon aria-hidden="true" />
          How referrals work
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full gap-0 sm:max-w-lg" showCloseButton={false}>
        <SheetHeader className="shrink-0 border-b px-5 py-5 pr-16">
          <SheetTitle>How referrals work</SheetTitle>
          <SheetDescription>Eligibility, benefits, and incentive settings.</SheetDescription>
        </SheetHeader>
        <SheetClose asChild>
          <Button type="button" variant="ghost" size="icon" className="absolute right-2 top-2 size-11" aria-label="Close referral guide">
            <XIcon aria-hidden="true" />
          </Button>
        </SheetClose>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
          <ReferralPolicyDetails />
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function ReferralPolicyDetails() {
  return (
    <div className="space-y-5 text-sm leading-relaxed">
      <section className="space-y-2" aria-label="Referral codes">
        <h3 className="font-semibold">Who can share a code</h3>
        <p className="text-muted-foreground">
          Students enrolled in Grade 11 in the previous school year can create a referral code for the target school year while the incentive is enabled.
        </p>
        <p className="text-muted-foreground">
          New or transferee Grade 11 applicants enter a valid code for their school year before submitting their application. A code can be shared with multiple applicants. Students cannot refer themselves.
        </p>
      </section>
      <section className="space-y-3 border-t pt-5" aria-label="Referral eligibility">
        <h3 className="font-semibold">When each student qualifies</h3>
        <dl className="space-y-3">
          <div className="space-y-1">
            <dt className="font-medium">Grade 11 applicant</dt>
            <dd className="text-muted-foreground">Their application is accepted with a valid referral code by the enrollment cutoff.</dd>
          </div>
          <div className="space-y-1">
            <dt className="font-medium">Grade 12 referrer</dt>
            <dd className="space-y-1 text-muted-foreground">
              <p>One referred Grade 11 student must be officially enrolled by the enrollment cutoff.</p>
              <p>The Grade 12 benefit is awarded once per school year. Extra referrals do not add credit, but additional applicants can still qualify for their own benefit.</p>
            </dd>
          </div>
        </dl>
      </section>
      <section className="space-y-2 border-t pt-5" aria-label="Voucher requirement">
        <h3 className="font-semibold">Each student needs their own voucher</h3>
        <p className="text-muted-foreground">
          Each student must have their own active voucher for their enrollment. They qualify independently; a missing voucher for one student does not block the other.
        </p>
      </section>
      <section className="space-y-2 border-t pt-5" aria-label="Referral benefit">
        <h3 className="font-semibold">What the benefit covers</h3>
        <p className="text-muted-foreground">
          The benefit waives each eligible student’s remaining unpaid bill, including miscellaneous fees, after their voucher is applied.
        </p>
        <p className="text-muted-foreground">
          Previous payments are not refunded or carried forward. If the bill is already covered, no additional credit is issued.
        </p>
      </section>
      <section className="space-y-2 border-t pt-5" aria-label="Unresolved referrals">
        <h3 className="font-semibold">Resolving a payment hold</h3>
        <p className="text-muted-foreground">Creating a code reserves the Grade 12 benefit and pauses payments on the referrer’s bill when it has an active voucher. Bills can still be generated. Create the code before submitting or recording any Grade 12 payment.</p>
        <p className="text-muted-foreground">The hold ends when the benefit is applied or the school’s enrollment cutoff passes without a qualifying referral. Rejection does not end the reservation early: another applicant may still qualify. A later enrollment cannot earn the referrer benefit after the cutoff.</p>
      </section>
      <section className="space-y-2 border-t pt-5" aria-label="Incentive settings">
        <h3 className="font-semibold">Enabling or disabling the incentive</h3>
        <p className="text-muted-foreground">
          Set an enrollment cutoff before enabling referrals during normal admissions. The cutoff ends at 11:59 PM Philippine time and is locked once codes are issued.
        </p>
        <p className="text-muted-foreground">
          Disabling stops new referral codes and claims. Existing successful referrals and applied benefits are kept.
        </p>
      </section>
    </div>
  );
}
