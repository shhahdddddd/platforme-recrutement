<!DOCTYPE html>
<html>

<head>
    <title>Mise à jour de votre candidature</title>
</head>

<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f8fafc;">
    <div style="max-width: 600px; margin: 40px auto; padding: 0;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #6366F1, #8B5CF6); padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
            <h1 style="color: #ffffff; font-size: 24px; margin: 0;">RecrutiTN</h1>
            <p style="color: rgba(255,255,255,0.8); font-size: 13px; margin: 5px 0 0;">Plateforme de recrutement intelligente</p>
        </div>

        <!-- Body -->
        <div style="background: #ffffff; padding: 35px 30px; border: 1px solid #e2e8f0; border-top: none;">
            <h2 style="color: #1e293b; font-size: 20px; margin: 0 0 20px;">Mise à jour de votre candidature</h2>

            <p>Bonjour <strong>{{ $candidateName }}</strong>,</p>

            <p>Nous tenons à vous remercier pour l'intérêt que vous avez porté au poste de
                <strong>{{ $jobTitle }}</strong> chez <strong>{{ $companyName }}</strong>.
            </p>

            <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 16px 20px; border-radius: 0 8px 8px 0; margin: 25px 0;">
                <p style="margin: 0; color: #991b1b; font-weight: 600;">
                    Après examen attentif de votre profil, nous avons le regret de vous informer que votre candidature
                    n'a pas été retenue pour ce poste.
                </p>
            </div>

            <p>Cette décision ne remet en aucun cas en question vos compétences. Le processus de sélection est
                compétitif et nous vous encourageons vivement à postuler à d'autres opportunités qui correspondent à
                votre profil.</p>

            <p>Nous vous souhaitons beaucoup de succès dans vos recherches professionnelles.</p>

            <p style="margin-top: 30px;">Cordialement,<br>
                <strong>L'équipe {{ $companyName }}</strong>
            </p>
        </div>

        <!-- Footer -->
        <div style="background: #f1f5f9; padding: 20px 30px; border-radius: 0 0 16px 16px; border: 1px solid #e2e8f0; border-top: none; text-align: center;">
            <p style="font-size: 12px; color: #94a3b8; margin: 0;">
                &copy; {{ date('Y') }} RecrutiTN. Tous droits réservés.
            </p>
            <p style="font-size: 11px; color: #cbd5e1; margin: 5px 0 0;">
                Cet e-mail a été envoyé automatiquement. Merci de ne pas y répondre.
            </p>
        </div>
    </div>
</body>

</html>
