import 'package:flutter/material.dart';

class OnboardingPageModel {
  final String title;
  final String description;
  final String illustrationAsset;
  final Color backgroundColor;
  final Color accentColor;

  OnboardingPageModel({
    required this.title,
    required this.description,
    required this.illustrationAsset,
    this.backgroundColor = Colors.white,
    this.accentColor = const Color(0xFF3B82F6),
  });
}

// Onboarding data for 4 professional screens - All blue theme
final List<OnboardingPageModel> onboardingPages = [
  OnboardingPageModel(
    title: 'Discover Your\nDream Career',
    description: 'Explore thousands of job opportunities from top companies. Your next big career move starts here.',
    illustrationAsset: 'assets/images/onboarding/discover.png',
    backgroundColor: Colors.white,
    accentColor: const Color(0xFF3B82F6),
  ),
  OnboardingPageModel(
    title: 'AI-Powered\nSmart Matching',
    description: 'Our intelligent algorithm matches your skills and experience with the perfect job opportunities instantly.',
    illustrationAsset: 'assets/images/onboarding/matching.png',
    backgroundColor: Colors.white,
    accentColor: const Color(0xFF3B82F6),
  ),
  OnboardingPageModel(
    title: 'Track Every\nApplication',
    description: 'Stay updated with real-time notifications. Know exactly where you stand in the hiring process.',
    illustrationAsset: 'assets/images/onboarding/track.png',
    backgroundColor: Colors.white,
    accentColor: const Color(0xFF3B82F6),
  ),
  OnboardingPageModel(
    title: 'Start Your\nJourney Today',
    description: 'Join 10,000+ professionals who found their perfect role. Your future is just one tap away.',
    illustrationAsset: 'assets/images/onboarding/start.png',
    backgroundColor: Colors.white,
    accentColor: const Color(0xFF3B82F6),
  ),
];
