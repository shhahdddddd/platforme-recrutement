from django.db import models
import uuid
import logging
import hashlib

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Encrypted Field Descriptor (imported from security module)
# ---------------------------------------------------------------------------

from .services.security.encryption import EncryptedTextField


# ---------------------------------------------------------------------------
# Knowledge Base Documents
# ---------------------------------------------------------------------------

class KBDocument(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('ready', 'Ready'),
        ('superseded', 'Superseded'),
        ('failed', 'Failed'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company_id = models.IntegerField() # Linked to Laravel company id
    uploader_id = models.IntegerField() # Linked to Laravel user id
    original_filename = models.CharField(max_length=255)
    minio_path = models.CharField(max_length=512)
    
    # Processed text - ENCRYPTED AT REST (sensitive HR document content)
    _full_text = models.TextField(null=True, blank=True, db_column='full_text')
    full_text = EncryptedTextField('_full_text')
    
    # Classification results (JSON)
    domain_tags = models.JSONField(default=list, blank=True)
    seniority_scores = models.JSONField(default=dict, blank=True)
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    
    error_message = models.TextField(null=True, blank=True)
    
    total_sections = models.IntegerField(default=0)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'kb_documents'
        indexes = [
            models.Index(fields=['company_id']),
            models.Index(fields=['status']),
        ]

class ParentChunk(models.Model):
    document = models.ForeignKey(KBDocument, on_delete=models.CASCADE, related_name='parent_chunks')
    company_id = models.IntegerField() # Redundant for isolation guarantee
    chunk_index = models.IntegerField()
    
    # Content - ENCRYPTED AT REST (sensitive HR document content)
    _content = models.TextField(db_column='content')
    content = EncryptedTextField('_content')
    
    _summary = models.TextField(null=True, blank=True, db_column='summary')
    summary = EncryptedTextField('_summary')
    
    # BGE-M3 Vector Embedding (Stored as binary blob for maximum portability)
    embedding = models.BinaryField(null=True, blank=True)
    
    # Quality control
    summary_quality_score = models.FloatField(null=True, blank=True)
    summary_quality_flag = models.BooleanField(default=False)
    
    # Inherited metadata
    domain = models.JSONField(default=list, blank=True)
    seniority_junior = models.IntegerField(default=0)
    seniority_mid = models.IntegerField(default=0)
    seniority_senior = models.IntegerField(default=0)
    
    # Source audit
    source_filename = models.CharField(max_length=255)
    estimated_page_number = models.IntegerField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'parent_chunks'
        indexes = [
            models.Index(fields=['company_id']),
        ]

class ChildChunk(models.Model):
    parent = models.ForeignKey(ParentChunk, on_delete=models.CASCADE, related_name='child_chunks')
    document = models.ForeignKey(KBDocument, on_delete=models.CASCADE, related_name='child_chunks')
    company_id = models.IntegerField()
    chunk_index = models.IntegerField() # Index within the document
    
    # Content - ENCRYPTED AT REST
    _content = models.TextField(db_column='content')
    content = EncryptedTextField('_content')
    
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'child_chunks'
        indexes = [
            models.Index(fields=['company_id']),
        ]

class SectionSummary(models.Model):
    company_id = models.IntegerField()
    cluster_id = models.IntegerField()
    meta_summary = models.TextField()
    
    # BGE-M3 Vector Embedding
    embedding = models.BinaryField(null=True, blank=True)
    
    parent_chunk_ids = models.JSONField(default=list) # List of IDs in this cluster
    
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'section_summaries'
        indexes = [
            models.Index(fields=['company_id']),
        ]

class QuizSession(models.Model):
    STATUS_CHOICES = [
        ('generating', 'Generating'),
        ('review', 'Under Review'),
        ('ready', 'Ready'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]
    DIFFICULTY_CHOICES = [
        ('easy', 'Easy'),
        ('medium', 'Medium'),
        ('hard', 'Hard'),
        ('mixed', 'Mixed'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    candidate_id = models.IntegerField() # Laravel id
    job_offer_id = models.IntegerField() # Laravel id
    company_id = models.IntegerField()
    hr_initiator_id = models.IntegerField()

    # Job context for RAG-grounded question generation
    job_title = models.CharField(max_length=255, blank=True, default='')
    job_description = models.TextField(blank=True, default='')
    job_skills = models.JSONField(default=list, blank=True)  # legacy field, not used for quiz generation
    job_offer_type = models.CharField(max_length=50, blank=True, default='job')
    seniority_level = models.CharField(max_length=20, blank=True, default='mid')

    num_questions = models.IntegerField(default=8)
    difficulty_setting = models.CharField(max_length=20, choices=DIFFICULTY_CHOICES, default='mixed')
    time_limit = models.IntegerField(null=True, blank=True) # in minutes
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='generating')
    
    # State tracking
    skills_covered = models.JSONField(default=list, blank=True)
    total_score = models.FloatField(default=0.0)
    
    created_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    deadline = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'quiz_sessions'
        indexes = [
            models.Index(fields=['candidate_id', 'job_offer_id']),
            models.Index(fields=['company_id']),
        ]

class QuizQuestion(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey(QuizSession, on_delete=models.CASCADE, related_name='questions')
    question_number = models.IntegerField()
    
    question_text = models.TextField()
    skill_targeted = models.CharField(max_length=100)
    difficulty = models.CharField(max_length=20)
    
    reference_answer = models.TextField()
    explanation = models.TextField(blank=True, default='')   # why correct_choice is right
    choices = models.JSONField(default=list)                 # ["option A text", "option B", "option C", "option D"]
    correct_choice = models.CharField(max_length=1, default='A')  # 'A' | 'B' | 'C' | 'D'
    follow_up_hint = models.TextField(null=True, blank=True)
    estimated_answer_length = models.IntegerField(default=200)
    
    # RAG metadata
    hyde_query = models.TextField(null=True, blank=True)
    source_passage_indices = models.JSONField(default=list) 
    
    # Skill management (Node 7)
    skill_embedding = models.BinaryField(null=True, blank=True)
    
    # Branching
    is_followup = models.BooleanField(default=False)
    parent_question = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='follow_ups')
    
    # Quality control (Node 7)
    hallucination_flag = models.BooleanField(default=False)
    hr_approved = models.BooleanField(default=False)
    
    # STAFF OPTIMIZATION: Feedback loop for continuous knowledge base improvement
    CANDIDATE_FEEDBACK_CHOICES = [
        ('fausse', 'Fausse / Hors Sujet'),
        ('trop_facile', 'Trop facile'),
        ('trop_dure', 'Trop dure'),
        ('bonne', 'Bonne question'),
    ]
    candidate_feedback = models.CharField(max_length=20, choices=CANDIDATE_FEEDBACK_CHOICES, null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'quiz_questions'
        unique_together = ('session', 'question_number')

class QuizAnswer(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('scored', 'Scored'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey(QuizSession, on_delete=models.CASCADE, related_name='answers')
    question = models.ForeignKey(QuizQuestion, on_delete=models.CASCADE, related_name='candidate_answers')
    
    # Candidate answer - ENCRYPTED AT REST (sensitive candidate data)
    _answer_text = models.TextField(blank=True, default='', db_column='answer_text')
    answer_text = EncryptedTextField('_answer_text')
    
    selected_choice = models.CharField(max_length=1, null=True, blank=True)  # 'A' | 'B' | 'C' | 'D'
    is_correct = models.BooleanField(null=True, blank=True)
    
    # Scoring Signals (Step 5)
    rouge_score = models.FloatField(default=0.0)
    bert_score = models.FloatField(default=0.0)
    cosine_score = models.FloatField(default=0.0)
    llm_score = models.FloatField(default=0.0)
    
    final_score = models.FloatField(default=0.0) # 0-100
    
    # Scoring reasoning - ENCRYPTED AT REST (sensitive evaluation details)
    _scoring_reasoning = models.TextField(null=True, blank=True, db_column='scoring_reasoning')
    scoring_reasoning = EncryptedTextField('_scoring_reasoning')
    missing_concepts = models.JSONField(default=list)
    correct_concepts = models.JSONField(default=list)
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    scored_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'quiz_answers'

class QuizReport(models.Model):
    session = models.OneToOneField(QuizSession, on_delete=models.CASCADE, primary_key=True, related_name='report')
    
    total_score_normalized = models.FloatField()
    narrative_summary = models.TextField()
    
    # Categorized results (Step 7)
    skill_breakdown = models.JSONField() # {skill: avg_score}
    critical_gaps = models.JSONField()
    confirmed_strengths = models.JSONField()
    interview_suggestions = models.JSONField()
    
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'quiz_reports'

class MatchingFeedback(models.Model):
    """
    STABLE FEEDBACK STORAGE - Replaces feedback_store.json
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    candidate_id = models.IntegerField()
    job_id = models.IntegerField()
    decision = models.CharField(max_length=20) # hired, rejected, interviewed
    scores = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'matching_feedback'
        indexes = [
            models.Index(fields=['candidate_id']),
            models.Index(fields=['job_id']),
            models.Index(fields=['decision']),
        ]

class WeightBias(models.Model):
    """
    Persists optimized biases from the learning loop.
    """
    id = models.AutoField(primary_key=True)
    skill_bias = models.FloatField(default=0.0)
    experience_bias = models.FloatField(default=0.0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'weight_biases'

class JobDescription(models.Model):
    """
    STABLE JD STORAGE - Detects content changes to invalidate stale matches.
    """
    job_id = models.IntegerField(unique=True) # Laravel ID
    content = models.TextField()
    content_hash = models.CharField(max_length=64, blank=True)
    parsed_profile = models.JSONField(null=True, blank=True)
    parsed_at = models.DateTimeField(auto_now=True)
    
    def save(self, *args, **kwargs):
        # Detect if content changed via hash
        new_hash = hashlib.md5(self.content.encode('utf-8')).hexdigest()
        if new_hash != self.content_hash:
            self.content_hash = new_hash
            # Automated Invalidation: Mark all previous matches for this job as stale
            MatchResult.objects.filter(job_id=self.job_id).update(is_stale=True)
            logger.info("JD content changed for job %s. Invalidated existing matches.", self.job_id)
        super().save(*args, **kwargs)

    class Meta:
        db_table = 'job_descriptions'

class MatchResult(models.Model):
    """
    Persists final matching results and tracks validity.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    job_id = models.IntegerField()
    candidate_id = models.IntegerField()
    score = models.FloatField()
    result_data = models.JSONField()
    is_stale = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'match_results'
        unique_together = ('job_id', 'candidate_id')
        indexes = [
            models.Index(fields=['job_id', 'candidate_id']),
            models.Index(fields=['is_stale']),
        ]
