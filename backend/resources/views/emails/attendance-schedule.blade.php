<!DOCTYPE html>
<html>

<head>
    <title>Your Attendance Schedule - {{ $companyName }}</title>
</head>

<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f8fafc;">
    <div style="max-width: 600px; margin: 40px auto; padding: 0;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #8B5CF6, #6366F1); padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
            <h1 style="color: #ffffff; font-size: 24px; margin: 0;">{{ $companyName }}</h1>
            <p style="color: rgba(255,255,255,0.8); font-size: 13px; margin: 5px 0 0;">Human Resources Department</p>
        </div>

        <!-- Body -->
        <div style="background: #ffffff; padding: 35px 30px; border: 1px solid #e2e8f0; border-top: none;">
            <h2 style="color: #5B21B6; font-size: 20px; margin: 0 0 20px;">Your Attendance Schedule</h2>

            <p>Dear <strong>{{ $candidateName }}</strong>,</p>

            <p>We hope you are doing well.</p>

            <p>As part of your internship program at <strong>{{ $companyName }}</strong>, we are pleased to confirm your attendance schedule as defined by the Human Resources department.</p>

            <div style="background: #F5F3FF; border: 2px solid #8B5CF6; padding: 25px; border-radius: 12px; margin: 25px 0;">
                <h3 style="color: #5B21B6; font-size: 16px; margin: 0 0 15px;">📅 Your Attendance Schedule:</h3>
                
                <p style="margin: 10px 0;"><strong>Position:</strong> {{ $jobTitle }}</p>
                
                <p style="margin: 10px 0;"><strong>Attendance Type:</strong> 
                    <span style="background: #8B5CF6; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; text-transform: uppercase;">
                        {{ ucfirst($attendanceType) }}
                    </span>
                </p>

                @if($startDate)
                <p style="margin: 10px 0;"><strong>Start Date:</strong> {{ \Carbon\Carbon::parse($startDate)->format('d/m/Y') }}</p>
                @endif

                @if($endDate)
                <p style="margin: 10px 0;"><strong>End Date:</strong> {{ \Carbon\Carbon::parse($endDate)->format('d/m/Y') }}</p>
                @endif

                @if($attendanceSchedule && !empty($attendanceSchedule['days']))
                <p style="margin: 10px 0;"><strong>Working Days:</strong> {{ implode(', ', $attendanceSchedule['days']) }}</p>
                @endif

                @if($attendanceSchedule && isset($attendanceSchedule['start_time']) && isset($attendanceSchedule['end_time']))
                <p style="margin: 10px 0;"><strong>Working Hours:</strong> 
                    {{ \Carbon\Carbon::parse($attendanceSchedule['start_time'])->format('h:i A') }} – {{ \Carbon\Carbon::parse($attendanceSchedule['end_time'])->format('h:i A') }}
                </p>
                @endif
            </div>

            <p>Please ensure punctual attendance according to the schedule above. Any absence or delay should be communicated in advance through the platform.</p>

            <div style="background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 16px 20px; border-radius: 0 8px 8px 0; margin: 25px 0;">
                <h4 style="color: #92400E; font-size: 14px; margin: 0 0 10px;">📌 Important Notes:</h4>
                <ul style="margin: 0; padding-left: 20px; color: #92400E; font-size: 13px;">
                    <li style="margin: 5px 0;">You are required to check in and check out daily via the platform.</li>
                    <li style="margin: 5px 0;">Your attendance will be monitored automatically.</li>
                    <li style="margin: 5px 0;">Repeated absences may affect your internship evaluation.</li>
                </ul>
            </div>

            <p>If you have any questions or need clarification, feel free to contact the HR department.</p>

            <p>We wish you a productive and successful internship experience.</p>

            <p style="margin-top: 30px;">Best regards,<br>
                <strong>Human Resources Department<br>
                {{ $companyName }}</strong>
            </p>
        </div>

        <!-- Footer -->
        <div style="background: #f1f5f9; padding: 20px 30px; border-radius: 0 0 16px 16px; border: 1px solid #e2e8f0; border-top: none; text-align: center;">
            <p style="font-size: 12px; color: #94a3b8; margin: 0;">
                &copy; {{ date('Y') }} {{ $companyName }}. All rights reserved.
            </p>
            <p style="font-size: 11px; color: #cbd5e1; margin: 5px 0 0;">
                This email was sent automatically. Please do not reply.
            </p>
        </div>
    </div>
</body>

</html>
