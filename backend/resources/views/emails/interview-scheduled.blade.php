<!DOCTYPE html>
<html>

<head>
    <title>Interview scheduled</title>
</head>

<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #334155; margin: 0; padding: 0; background-color: #f8fafc;">
    <div style="max-width: 600px; margin: 40px auto; padding: 0;">
        <div style="background: linear-gradient(135deg, #2563eb, #0ea5e9); padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
            <h1 style="color: #ffffff; font-size: 24px; margin: 0;">RecrutiTN</h1>
            <p style="color: rgba(255,255,255,0.85); font-size: 13px; margin: 6px 0 0;">Interview schedule update</p>
        </div>

        <div style="background: #ffffff; padding: 35px 30px; border: 1px solid #e2e8f0; border-top: none;">
            <h2 style="color: #0f172a; font-size: 22px; margin: 0 0 20px;">Your interview is now scheduled</h2>

            <p>Hello <strong>{{ $candidateName }}</strong>,</p>

            <p>
                Your interview for <strong>{{ $jobTitle }}</strong> at
                <strong>{{ $companyName }}</strong> has been scheduled.
            </p>

            <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 14px; padding: 20px; margin: 24px 0;">
                <p style="margin: 0 0 10px; font-weight: 700; color: #1d4ed8;">Interview details</p>
                <p style="margin: 0 0 6px;"><strong>Type:</strong> {{ $interviewType }}</p>
                <p style="margin: 0 0 6px;"><strong>Mode:</strong> {{ $interviewMode }}</p>
                <p style="margin: 0 0 6px;"><strong>Date and time:</strong> {{ $scheduledAtLabel }}</p>
                @if($durationMinutes)
                    <p style="margin: 0 0 6px;"><strong>Duration:</strong> {{ $durationMinutes }} minutes</p>
                @endif
                @if(!empty($notes))
                    <p style="margin: 10px 0 0;"><strong>Notes:</strong> {{ $notes }}</p>
                @endif
            </div>

            <p>
                This email shows the same scheduled date and time that was assigned to your interview in the platform.
                You can also check the latest status in the RecrutiTN app.
            </p>

            <p style="margin-top: 30px;">
                Best regards,<br>
                <strong>{{ $companyName }} recruitment team</strong>
            </p>
        </div>

        <div style="background: #f1f5f9; padding: 20px 30px; border-radius: 0 0 16px 16px; border: 1px solid #e2e8f0; border-top: none; text-align: center;">
            <p style="font-size: 12px; color: #94a3b8; margin: 0;">
                &copy; {{ date('Y') }} RecrutiTN. All rights reserved.
            </p>
            <p style="font-size: 11px; color: #cbd5e1; margin: 5px 0 0;">
                This email was sent automatically. Please do not reply.
            </p>
        </div>
    </div>
</body>

</html>
