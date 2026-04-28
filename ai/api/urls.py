from django.urls import path
from .views import (
    KBDocumentUploadView,
    KBDocumentDetailView,
    CandidateSubmitAnswerView,
    CandidateQuizSessionView,
    AnswerStatusView,
    HRReviewQuizView,
    FinalizeQuizView,
    GenerateQuizView,
    QuizReportView,
    ReorderQuizView,
    RegenerateQuizQuestionView,
    StartQuizView,
    ScoreCvView,                    # Single CV scoring
    BatchScoreApplicantsView,       # Batch parallel scoring
    VectorStoreStatsView,           # ChromaDB stats
    VectorStoreHealthView,          # ChromaDB health
    AIServiceHealthView,            # AI service diagnostics
    FeedbackView,                   # Recruiter feedback loop
)

urlpatterns = [
    # AI Matching endpoints
    path('score/', ScoreCvView.as_view(), name='score-cv'),
    path('score/batch/', BatchScoreApplicantsView.as_view(), name='score-batch'),
    path('feedback/', FeedbackView.as_view(), name='feedback'),

    # Ingestion phase (RH uploads PDFs)
    path('documents/upload/', KBDocumentUploadView.as_view(), name='kb-document-upload'),
    path('documents/<uuid:doc_id>/', KBDocumentDetailView.as_view(), name='kb-document-detail'),

    # Generation Phase — Laravel calls this when HR clicks "Launch Assessment"
    path('quiz/launch/', StartQuizView.as_view(), name='quiz-launch'),
    path('candidates/<int:candidate_id>/start-quiz/', StartQuizView.as_view(), name='start-quiz'),

    # Legacy manual trigger
    path('quiz/generate/', GenerateQuizView.as_view(), name='generate-quiz'),

    # Review Phase (RH audits/edits draft quiz)
    path('quiz/<uuid:session_id>/review/', HRReviewQuizView.as_view(), name='review-quiz'),
    path('quiz/<uuid:session_id>/reorder/', ReorderQuizView.as_view(), name='reorder-quiz'),
    path('quiz/question/<uuid:question_id>/edit/', HRReviewQuizView.as_view(), name='edit-question'),
    path('quiz/question/<uuid:question_id>/regenerate/', RegenerateQuizQuestionView.as_view(), name='regenerate-question'),
    path('quiz/<uuid:session_id>/report/', QuizReportView.as_view(), name='quiz-report'),

    # Finalize Phase (RH sends to candidate)
    path('quiz/<uuid:session_id>/finalize/', FinalizeQuizView.as_view(), name='finalize-quiz'),

    # Candidate Assessment Phase (Flutter submission & polling)
    path('quiz/<uuid:session_id>/candidate/', CandidateQuizSessionView.as_view(), name='candidate-quiz-session'),
    path('answers/<uuid:question_id>/submit/', CandidateSubmitAnswerView.as_view(), name='submit-answer'),
    path('answers/<uuid:answer_id>/status/', AnswerStatusView.as_view(), name='answer-status'),
    
    # ChromaDB Vector Store Management
    path('vector-store/stats/', VectorStoreStatsView.as_view(), name='vector-store-stats'),
    path('vector-store/health/', VectorStoreHealthView.as_view(), name='vector-store-health'),
    
    # AI Service Diagnostics
    path('ai-health/', AIServiceHealthView.as_view(), name='ai-health'),
]
