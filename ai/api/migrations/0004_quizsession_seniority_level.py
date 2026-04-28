from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0003_quizquestion_hallucination_flag'),
    ]

    operations = [
        migrations.AddField(
            model_name='quizsession',
            name='seniority_level',
            field=models.CharField(blank=True, default='mid', max_length=20),
        ),
    ]
