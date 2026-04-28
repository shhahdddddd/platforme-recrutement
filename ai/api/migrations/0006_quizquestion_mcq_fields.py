from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0005_quizquestion_hr_approved'),
    ]

    operations = [
        # QuizQuestion: MCQ choices + correct answer
        migrations.AddField(
            model_name='quizquestion',
            name='choices',
            field=models.JSONField(default=list),
        ),
        migrations.AddField(
            model_name='quizquestion',
            name='correct_choice',
            field=models.CharField(default='A', max_length=1),
        ),
        migrations.AddField(
            model_name='quizquestion',
            name='explanation',
            field=models.TextField(blank=True, default=''),
        ),
        # QuizAnswer: selected choice + correctness flag
        migrations.AddField(
            model_name='quizanswer',
            name='selected_choice',
            field=models.CharField(blank=True, max_length=1, null=True),
        ),
        migrations.AddField(
            model_name='quizanswer',
            name='is_correct',
            field=models.BooleanField(blank=True, null=True),
        ),
        # answer_text is now optional (MCQ needs no free-text)
        migrations.AlterField(
            model_name='quizanswer',
            name='answer_text',
            field=models.TextField(blank=True, default=''),
        ),
    ]
