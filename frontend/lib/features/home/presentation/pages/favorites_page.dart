import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:recrutitn/l10n/app_localizations.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../auth/presentation/bloc/auth_bloc.dart';
import '../../../auth/presentation/bloc/auth_state.dart';
import '../bloc/saved_jobs_bloc.dart';
import '../bloc/saved_jobs_event.dart';
import '../bloc/saved_jobs_state.dart';
import '../widgets/job_card.dart';
import 'apply_job_page.dart';

class FavoritesPage extends StatefulWidget {
  const FavoritesPage({super.key});

  @override
  State<FavoritesPage> createState() => _FavoritesPageState();
}

class _FavoritesPageState extends State<FavoritesPage> {
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _loadFavorites();
  }

  void _loadFavorites() {
    final authState = context.read<AuthBloc>().state;
    if (authState is AuthAuthenticated) {
      setState(() => _isLoading = true);
      context.read<SavedJobsBloc>().add(LoadSavedJobs(authState.user.id));
      // Reset loading after a short delay
      Future.delayed(const Duration(milliseconds: 500), () {
        if (mounted) setState(() => _isLoading = false);
      });
    }
  }

  Future<void> _refreshFavorites() async {
    final authState = context.read<AuthBloc>().state;
    if (authState is AuthAuthenticated) {
      context.read<SavedJobsBloc>().add(LoadSavedJobs(authState.user.id));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.backgroundColor,
      appBar: AppBar(
        backgroundColor: AppTheme.backgroundColor,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: AppTheme.textColor, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          AppLocalizations.of(context)!.favorites,
          style: const TextStyle(
            color: AppTheme.textColor,
            fontSize: 18,
            fontWeight: FontWeight.w900,
            letterSpacing: -0.5,
          ),
        ),
        centerTitle: true,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded, color: AppTheme.textColor),
            onPressed: _refreshFavorites,
          ),
        ],
      ),
      body: BlocBuilder<SavedJobsBloc, SavedJobsState>(
        builder: (context, state) {
          if (state is SavedJobsLoaded && !_isLoading) {
            final favorites = state.savedJobs;

            if (favorites.isEmpty) {
              return Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(32),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        shape: BoxShape.circle,
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.05),
                            blurRadius: 20,
                            offset: const Offset(0, 10),
                          ),
                        ],
                      ),
                      child: Icon(
                        Icons.favorite_border_rounded,
                        size: 64,
                        color: Colors.grey.shade300,
                      ),
                    ),
                    const SizedBox(height: 24),
                    Text(
                      "No favorites yet",
                      style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w800,
                        color: Colors.grey.shade400,
                        letterSpacing: -0.5,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      "Your saved jobs will appear here.",
                      style: TextStyle(
                        fontSize: 14,
                        color: Colors.grey.shade400,
                      ),
                    ),
                  ],
                ),
              );
            }

            return RefreshIndicator(
              onRefresh: _refreshFavorites,
              color: AppTheme.primaryColor,
              backgroundColor: Colors.white,
              child: ListView.builder(
                padding: const EdgeInsets.all(16),
                itemCount: favorites.length,
                physics: const AlwaysScrollableScrollPhysics(),
                itemBuilder: (context, index) {
                  final job = favorites[index];
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 16.0),
                    child: GestureDetector(
                      onTap: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => ApplyJobPage(job: job),
                          ),
                        );
                      },
                      child: JobCard(
                        job: job,
                        title: job.title,
                        company: job.companyName,
                        location: job.location,
                        salary: job.budget > 0 ? '${job.budget.toStringAsFixed(0)} TND' : 'Negotiable',
                        description: job.description,
                        datePosted: job.datePosted,
                        logoUrl: job.companyLogo,
                        tags: [
                          job.offerType,
                          job.contractType,
                          ...job.skills.take(2),
                        ],
                      ),
                    ),
                  );
                },
              ),
            );
          }
          // Show loading indicator while loading
          if (_isLoading) {
            return const Center(child: CircularProgressIndicator());
          }
          return const Center(child: CircularProgressIndicator());
        },
      ),
    );
  }
}
