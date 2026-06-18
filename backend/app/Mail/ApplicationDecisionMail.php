<?php

namespace App\Mail;

use App\Models\Application;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class ApplicationDecisionMail extends Mailable
{
    use Queueable;
    use SerializesModels;

    /**
     * @param  'accepted'|'rejected'  $decision
     */
    public function __construct(
        public Application $application,
        public string $decision,
        public string $applicationsUrl,
    ) {}

    public function envelope(): Envelope
    {
        $subject = $this->decision === 'accepted'
            ? 'Your application has been accepted – Enrobill'
            : 'Update on your enrollment application – Enrobill';

        return new Envelope(subject: $subject);
    }

    public function content(): Content
    {
        $applicant = $this->application->user;

        return new Content(
            view: 'emails.application-decision',
            with: [
                'name' => $applicant->first_name ?? $applicant->name,
                'appName' => config('app.name'),
                'decision' => $this->decision,
                'reference' => $this->application->reference,
                'schoolYear' => $this->application->school_year,
                'applicationsUrl' => $this->applicationsUrl,
            ],
        );
    }
}
