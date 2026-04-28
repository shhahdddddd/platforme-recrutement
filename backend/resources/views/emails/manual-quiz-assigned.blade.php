<!DOCTYPE html>
<html>

<head>
    <meta charset="utf-8">
    <title>Sujet : Évaluation Technique Assignée</title>
</head>

<body
    style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div
        style="background-color: #4f46e5; padding: 30px; border-radius: 15px; text-align: center; margin-bottom: 30px;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Nouvelle Évaluation Technique</h1>
    </div>

    <p>Bonjour <strong>{{ $candidateName }}</strong>,</p>

    <p>Nous avons le plaisir de vous informer qu'un recruteur a finalisé la préparation de votre évaluation technique
        pour le poste de <strong>{{ $jobTitle }}</strong>.</p>

    <p>Cette étape est cruciale pour nous permettre d'apprécier vos compétences techniques et votre adéquation avec les
        exigences du rôle.</p>

    <div
        style="background-color: #f8fafc; padding: 20px; border-left: 5px solid #4f46e5; border-radius: 5px; margin: 25px 0;">
        <p style="margin: 0;"><strong>Recruteur responsable :</strong> {{ $recruiterName }}</p>
        <p style="margin: 5px 0 0 0;"><strong>Plateforme :</strong> Application Mobile RecrutiTN (Flutter)</p>
    </div>

    <p><strong>Comment procéder ?</strong></p>
    <ol>
        <li>Ouvrez votre application mobile <strong>RecrutiTN</strong>.</li>
        <li>Connectez-vous à votre compte candidat.</li>
        <li>Rendez-vous dans la section "Mes Évaluations".</li>
        <li>Lancez l'examen lorsque vous êtes prêt(e) dans un environnement calme.</li>
    </ol>

    <p style="background-color: #fff7ed; padding: 15px; border-radius: 10px; color: #9a3412; font-size: 14px;">
        <em>Note : Une fois l'examen lancé sur mobile, veillez à ne pas quitter l'application avant d'avoir soumis vos
            réponses.</em>
    </p>

    <p>Nous vous souhaitons beaucoup de succès pour cette évaluation.</p>

    <p>Cordialement,<br>L'équipe RecrutiTN</p>

    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
    <p style="font-size: 12px; color: #999; text-align: center;">Ceci est un message automatique, merci de ne pas y
        répondre.</p>
</body>

</html>