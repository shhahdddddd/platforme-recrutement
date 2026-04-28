"""
WebSocket consumers for real-time quiz updates.
Uses Django Channels with Daphne ASGI server.
"""
import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from .models import QuizSession, QuizQuestion


class QuizConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for real-time quiz generation updates.
    RH sees live progress as questions are generated.
    """
    
    async def connect(self):
        self.session_id = self.scope['url_route']['kwargs']['session_id']
        self.room_group_name = f'quiz_{self.session_id}'
        
        # Join room group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        
        await self.accept()
        
        # Send initial status
        status = await self.get_quiz_status()
        await self.send(text_data=json.dumps({
            'type': 'connection_established',
            'session_id': self.session_id,
            'status': status
        }))
    
    async def disconnect(self, close_code):
        # Leave room group
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )
    
    async def receive(self, text_data):
        """Handle messages from client (if needed)."""
        data = json.loads(text_data)
        message_type = data.get('type')
        
        if message_type == 'ping':
            await self.send(text_data=json.dumps({
                'type': 'pong',
                'timestamp': data.get('timestamp')
            }))
    
    async def quiz_update(self, event):
        """Handle quiz update messages from channel layer."""
        await self.send(text_data=json.dumps({
            'type': 'quiz_update',
            'status': event.get('status'),
            'progress': event.get('progress'),
            'current_question': event.get('current_question'),
            'total_questions': event.get('total_questions'),
            'message': event.get('message')
        }))
    
    async def question_generated(self, event):
        """Handle real-time question generation notification."""
        await self.send(text_data=json.dumps({
            'type': 'question_generated',
            'question_number': event.get('question_number'),
            'total_questions': event.get('total_questions'),
            'difficulty': event.get('difficulty'),
            'question_preview': event.get('question_preview')
        }))
    
    @database_sync_to_async
    def get_quiz_status(self):
        """Get current quiz session status from database."""
        try:
            session = QuizSession.objects.get(id=self.session_id)
            generated_count = QuizQuestion.objects.filter(session=session).count()
            
            return {
                'session_status': session.status,
                'total_questions': session.num_questions,
                'generated_count': generated_count,
                'progress_percent': round((generated_count / session.num_questions) * 100, 1) if session.num_questions > 0 else 0
            }
        except QuizSession.DoesNotExist:
            return {'error': 'Session not found'}
