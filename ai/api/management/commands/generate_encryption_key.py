#!/usr/bin/env python
"""
Generate encryption key for sensitive data at rest.

Usage:
    python manage.py generate_encryption_key
    
Output:
    ENCRYPTION_KEY=... (add to .env file)
"""

from django.core.management.base import BaseCommand
from cryptography.fernet import Fernet


class Command(BaseCommand):
    help = 'Generate a new Fernet encryption key for sensitive data at rest'

    def handle(self, *args, **options):
        key = Fernet.generate_key().decode()
        
        self.stdout.write(self.style.SUCCESS('Generated new encryption key:'))
        self.stdout.write('')
        self.stdout.write(f'ENCRYPTION_KEY={key}')
        self.stdout.write('')
        self.stdout.write(self.style.WARNING('IMPORTANT:'))
        self.stdout.write('1. Add this to your .env file')
        self.stdout.write('2. Keep this key secure - losing it means losing access to encrypted data')
        self.stdout.write('3. Back up this key in a secure location')
        self.stdout.write('4. Do NOT commit the .env file to version control')
