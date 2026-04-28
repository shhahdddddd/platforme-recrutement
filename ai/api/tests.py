import asyncio
import pickle
from datetime import timedelta
from types import SimpleNamespace
from unittest import mock

import numpy as np
from django.test import SimpleTestCase
from django.utils.timezone import now
from rest_framework.test import APIRequestFactory

from api import tasks, utils, views, workflow


class FakeChildChunkQuerySet:
    def __init__(self, rows):
        self.rows = rows
        self.filter_kwargs = None
        self.order_fields = None
        self.values_list_fields = None

    def order_by(self, *fields):
        self.order_fields = fields
        return self

    def values_list(self, *fields):
        self.values_list_fields = fields
        return self.rows


class FakeChildChunkManager:
    def __init__(self, rows):
        self.queryset = FakeChildChunkQuerySet(rows)

    def filter(self, **kwargs):
        self.queryset.filter_kwargs = kwargs
        return self.queryset


class FakeBM25:
    def __init__(self, scores):
        self.scores = np.array(scores)

    def get_scores(self, tokens):
        return self.scores


class BM25IndexTests(SimpleTestCase):
    def setUp(self):
        utils._bm25_fallback_cache.clear()

    def tearDown(self):
        utils._bm25_fallback_cache.clear()

    @mock.patch.object(utils.redis_client, "set", return_value=True)
    def test_update_bm25_index_uses_ready_child_chunks_in_id_order(self, _redis_set):
        manager = FakeChildChunkManager([
            ("docker pipelines", 22),
            ("kubernetes scaling", 11),
        ])

        with mock.patch("api.models.ChildChunk.objects", manager):
            utils.update_bm25_index(7)

        payload = utils.get_bm25_index_data("7")
        self.assertEqual(
            manager.queryset.filter_kwargs,
            {"company_id": 7, "document__status": "ready"},
        )
        self.assertEqual(manager.queryset.order_fields, ("id",))
        self.assertEqual(manager.queryset.values_list_fields, ("content", "parent_id"))
        self.assertEqual(payload["parent_ids"], ["22", "11"])
        self.assertIsNotNone(payload["bm25"])

    def test_get_bm25_index_data_normalizes_cache_keys(self):
        sentinel_bm25 = object()
        utils._bm25_fallback_cache["42"] = {
            "bm25": sentinel_bm25,
            "parent_ids": [99],
        }

        payload = utils.get_bm25_index_data(42)
        self.assertIs(payload["bm25"], sentinel_bm25)
        self.assertEqual(payload["parent_ids"], ["99"])

    def test_extract_job_key_terms_prefers_explicit_technical_terms(self):
        description = (
            "We need a senior backend engineer who knows Django, PostgreSQL, Redis, Docker, "
            "and REST API design for a payments microservice migration."
        )

        terms = utils.extract_job_key_terms("Senior Backend Engineer", description)

        self.assertIn("django", terms)
        self.assertIn("postgresql", terms)
        self.assertIn("redis", terms)
        self.assertIn("docker", terms)

    def test_build_weighted_bm25_tokens_boosts_job_terms(self):
        tokens = utils.build_weighted_bm25_tokens(
            "query optimization for payment systems",
            key_terms=["postgresql"],
            extra_terms=["rest api"],
            boost=2,
        )

        self.assertGreaterEqual(tokens.count("postgresql"), 2)
        self.assertGreaterEqual(tokens.count("rest"), 2)
        self.assertGreaterEqual(tokens.count("api"), 2)


class HybridRetrieveNodeTests(SimpleTestCase):
    @staticmethod
    def _immediate_sync_to_async(func):
        async def runner(*args, **kwargs):
            return func(*args, **kwargs)

        return runner

    def test_hybrid_retrieve_node_uses_bm25_parent_mapping_without_child_chunk_query(self):
        state = {
            "is_cold_start": False,
            "hyde_query": "devops kubernetes",
            "company_id": "7",
            "min_seniority_score": 1,
        }
        parent_chunks = [
            SimpleNamespace(
                id=11,
                content="Kubernetes operations for junior DevOps engineers.",
                embedding=pickle.dumps([1.0, 0.0]),
                seniority_junior=1,
                seniority_mid=1,
                seniority_senior=1,
            ),
            SimpleNamespace(
                id=22,
                content="CI/CD pipeline troubleshooting for deployment workflows.",
                embedding=pickle.dumps([0.5, 0.0]),
                seniority_junior=1,
                seniority_mid=1,
                seniority_senior=1,
            ),
        ]

        with mock.patch("api.workflow.sync_to_async", new=self._immediate_sync_to_async), \
             mock.patch("api.models.ParentChunk.objects.filter", return_value=parent_chunks), \
             mock.patch("api.models.ChildChunk.objects.filter", side_effect=AssertionError("ChildChunk lookup should not run")), \
             mock.patch("api.workflow.get_embeddings", return_value=[[1.0, 0.0]]), \
             mock.patch(
                 "api.utils.get_bm25_index_data",
                 return_value={"bm25": FakeBM25([9.0, 1.0]), "parent_ids": ["22", "11"]},
             ), \
             mock.patch(
                 "api.workflow.calculate_rrf",
                 side_effect=lambda knn_ids, bm25_ids, top_k=10: (bm25_ids or knn_ids)[:top_k],
             ):
            result = asyncio.run(workflow.hybrid_retrieve_node(state))

        self.assertEqual(
            [chunk["id"] for chunk in result["retrieved_chunks"]],
            ["22", "11"],
        )


class QuizSessionStateTests(SimpleTestCase):
    def test_generate_quiz_questions_runs_locally_when_local_dispatch_is_preferred(self):
        session = SimpleNamespace(num_questions=8, difficulty_setting="mixed")

        with mock.patch("api.models.QuizSession.objects.get", return_value=session), \
             mock.patch("api.tasks._build_difficulty_map", return_value=["easy"] * 8) as build_map, \
             mock.patch("api.tasks._prefer_local_dispatch", return_value=True), \
             mock.patch("api.tasks._run_question_generation_locally", return_value="local_8") as run_local:
            result = tasks.generate_quiz_questions.run("session-1")

        self.assertEqual(result, "local_8")
        build_map.assert_called_once_with(8, "mixed")
        run_local.assert_called_once_with("session-1", ["easy"] * 8)

    def test_enqueue_answer_scoring_uses_celery_when_not_local(self):
        with mock.patch("api.tasks._prefer_local_dispatch", return_value=False), \
             mock.patch("api.tasks.score_answer.delay") as delay:
            mode = tasks.enqueue_answer_scoring("answer-7")

        self.assertEqual(mode, "celery")
        delay.assert_called_once_with("answer-7")

    def test_generate_single_question_failure_marks_session_failed(self):
        session = SimpleNamespace(
            id="session-1",
            company_id=7,
            job_title="DevOps Engineer",
            job_description="Build and maintain CI/CD pipelines.",
            job_offer_type="job",
            seniority_level="senior",
        )
        graph = SimpleNamespace(ainvoke=lambda state: "graph-call")
        parent_chunk_qs = SimpleNamespace(exists=lambda: True)

        with mock.patch("api.models.QuizSession.objects.get", return_value=session), \
             mock.patch("api.models.QuizSession.objects.filter") as session_filter, \
             mock.patch("api.models.ParentChunk.objects.filter", return_value=parent_chunk_qs), \
             mock.patch("api.workflow.create_quiz_graph", return_value=graph), \
             mock.patch("api.tasks.asyncio.run", side_effect=RuntimeError("boom")), \
             mock.patch("api.tasks.notify_laravel_failed") as notify_failed, \
             mock.patch.object(utils.redis_client, "set", return_value=True) as redis_set:
            result = tasks.generate_single_question.run("session-1", 0, "easy")

        self.assertEqual(result, "q_0_fail")
        session_filter.assert_any_call(id="session-1", status="generating")
        session_filter.return_value.update.assert_called_once_with(status="failed")
        notify_failed.assert_called_once_with(session_filter.return_value.first.return_value, "boom")
        redis_set.assert_called_once_with("session:status:session-1", "failed", ex=86400)

    def test_is_stale_generating_session_for_old_incomplete_generation_sessions(self):
        current_time = now()
        stale_session = SimpleNamespace(
            status="generating",
            created_at=current_time - timedelta(minutes=11),
            num_questions=8,
        )
        fresh_session = SimpleNamespace(
            status="generating",
            created_at=current_time - timedelta(minutes=3),
            num_questions=8,
        )

        self.assertTrue(views.is_stale_generating_session(stale_session, 0, current_time=current_time))
        self.assertTrue(views.is_stale_generating_session(stale_session, 1, current_time=current_time))
        self.assertFalse(views.is_stale_generating_session(stale_session, 8, current_time=current_time))
        self.assertFalse(views.is_stale_generating_session(fresh_session, 0, current_time=current_time))


class CandidateAnswerViewTests(SimpleTestCase):
    def test_candidate_submit_answer_uses_answer_text_and_dispatches_scoring(self):
        factory = APIRequestFactory()
        request = factory.post("/api/answers/question-1/submit/", {"answer": "Use Terraform and CI/CD."}, format="json")
        session = SimpleNamespace(
            id="session-1",
            status="ready",
            started_at=None,
            deadline=None,
            time_limit=30,
            save=mock.Mock(),
        )
        question = SimpleNamespace(id="question-1", session=session)
        answer = SimpleNamespace(id="answer-1", save=mock.Mock())

        with mock.patch("api.views.get_object_or_404", return_value=question), \
             mock.patch("api.models.QuizAnswer.objects.get_or_create", return_value=(answer, False)), \
             mock.patch("api.views.enqueue_answer_scoring", return_value="thread") as enqueue_scoring, \
             mock.patch.object(utils.redis_client, "set", return_value=True):
            response = views.CandidateSubmitAnswerView.as_view()(request, question_id="question-1")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(answer.answer_text, "Use Terraform and CI/CD.")
        self.assertEqual(answer.status, "pending")
        enqueue_scoring.assert_called_once_with("answer-1")
        session.save.assert_called_once()
        answer.save.assert_called_once()


class SerializationTests(SimpleTestCase):
    def test_serialize_question_marks_job_description_fallback_when_no_sources(self):
        question = SimpleNamespace(
            id="question-1",
            question_number=1,
            question_text="How would you design a REST API for payments?",
            skill_targeted="rest api design",
            difficulty="medium",
            follow_up_hint="Discuss versioning.",
            estimated_answer_length=200,
            source_passage_indices=[],
            hallucination_flag=False,
            hr_approved=False,
        )

        payload = views._serialize_question(question)

        self.assertEqual(payload["generation_mode"], "job_description_fallback")
        self.assertTrue(payload["knowledge_gap_flag"])
