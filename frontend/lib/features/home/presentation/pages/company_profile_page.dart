import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';

import '../../../../core/constants/app_constants.dart';
import '../../../../injection_container.dart';
import '../../domain/entities/company_entity.dart';
import '../../domain/entities/job_offer_entity.dart';
import 'apply_job_page.dart';

class CompanyProfilePage extends StatefulWidget {
  final int companyId;
  final String companyName;

  const CompanyProfilePage({
    super.key,
    required this.companyId,
    required this.companyName,
  });

  @override
  State<CompanyProfilePage> createState() => _CompanyProfilePageState();
}

class _CompanyProfilePageState extends State<CompanyProfilePage> with SingleTickerProviderStateMixin {
  final Dio _dio = sl<Dio>();
  bool _isLoading = true;
  String? _error;
  CompanyEntity? _company;

  late AnimationController _entranceController;
  late Animation<double> _fadeAnimation;
  late Animation<Offset> _slideAnimation;

  @override
  void initState() {
    super.initState();
    
    _entranceController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1000),
    );

    _fadeAnimation = CurvedAnimation(
      parent: _entranceController,
      curve: Curves.easeIn,
    );

    _slideAnimation = Tween<Offset>(
      begin: const Offset(0, 0.05),
      end: Offset.zero,
    ).animate(CurvedAnimation(
      parent: _entranceController,
      curve: Curves.easeOutCubic,
    ));

    _loadCompanyProfile();
  }

  @override
  void dispose() {
    _entranceController.dispose();
    super.dispose();
  }

  Future<void> _loadCompanyProfile() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final response = await _dio.get(
        '${AppConstants.apiBaseUrl}/companies/${widget.companyId}',
        options: Options(headers: {'Accept': 'application/json'}),
      );

      if (response.data is Map && response.data['data'] != null) {
        final data = response.data['data'] as Map<String, dynamic>;
        _company = _parseCompanyData(data);
        _entranceController.forward();
      } else {
        throw Exception('Invalid response format');
      }
    } on DioException catch (e) {
      setState(() {
        _error = 'Failed to load company profile: ${_extractErrorMessage(e)}';
      });
    } catch (e) {
      setState(() {
        _error = 'Failed to load company profile: $e';
      });
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  CompanyEntity _parseCompanyData(Map<String, dynamic> data) {
    final jobOffersData = data['job_offers'] as List<dynamic>? ?? [];
    final jobOffers = jobOffersData.map((job) {
      return JobOfferEntity(
        id: job['id'] ?? 0,
        title: job['title'] ?? '',
        description: job['description'] ?? '',
        location: job['location'] ?? '',
        offerType: job['offer_type'] ?? '',
        contractType: job['contract_type_detail'] ?? '',
        budget: job['budget'] != null ? double.parse(job['budget'].toString()) : 0.0,
        status: job['status'] ?? 'open',
        datePosted: job['date_posted'] ?? '',
        companyId: data['id'] ?? 0,
        companyName: data['name'] ?? '',
        companyLogo: data['picture'] ?? '',
        skills: (job['skills'] as List<dynamic>? ?? []).map((s) => s.toString()).toList(),
        department: job['department'] != null ? job['department']['name'] ?? 'General' : 'General',
      );
    }).toList();

    return CompanyEntity(
      id: data['id'] ?? 0,
      name: data['name'] ?? widget.companyName,
      description: data['description'],
      picture: data['picture'],
      location: data['location'],
      country: data['country'],
      industryId: data['industry_id'],
      industryName: data['industry'] != null ? data['industry']['name'] : null,
      employeeCount: data['employee_count']?.toString(),
      international: data['international'],
      companyType: data['company_type'],
      departmentsCount: data['departments_count'] ?? data['departments']?.length,
      recruitersCount: data['recruiters_count'] ?? data['recruiters']?.length,
      jobOffers: jobOffers,
    );
  }

  String _extractErrorMessage(DioException e) {
    if (e.response?.data is Map) {
      final data = e.response!.data as Map;
      return data['message']?.toString() ?? data['error']?.toString() ?? e.message ?? 'Unknown error';
    }
    return e.message ?? 'Unknown error';
  }

  String? _cleanText(String? value) {
    final normalized = value?.trim();
    if (normalized == null || normalized.isEmpty) return null;
    return normalized;
  }

  String _displayValue(String? value, {String fallback = 'Not specified'}) {
    return _cleanText(value) ?? fallback;
  }

  String _formatLabel(String value) {
    final normalized = value.trim().replaceAll('_', ' ');
    if (normalized.isEmpty) return value;

    return normalized
        .split(RegExp(r'\s+'))
        .where((part) => part.isNotEmpty)
        .map((part) => '${part[0].toUpperCase()}${part.substring(1).toLowerCase()}')
        .join(' ');
  }

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.dark.copyWith(
        statusBarColor: Colors.transparent,
      ),
      child: Scaffold(
        backgroundColor: const Color(0xFFF8FAFC),
        body: CustomScrollView(
          physics: const BouncingScrollPhysics(),
          slivers: [
            _buildSliverAppBar(),
            if (_isLoading)
              const SliverFillRemaining(
                child: Center(child: _PremiumLoader()),
              )
            else if (_error != null)
              SliverFillRemaining(
                child: _buildErrorState(),
              )
            else if (_company != null)
              _buildCompanyContent(),
          ],
        ),
      ),
    );
  }

  Widget _buildSliverAppBar() {
    return SliverAppBar(
      pinned: true,
      backgroundColor: const Color(0xFFF8FAFC),
      foregroundColor: const Color(0xFF1E293B),
      elevation: 0,
      leading: IconButton(
        icon: const Icon(Icons.arrow_back_ios_rounded, color: Color(0xFF1E293B)),
        onPressed: () => Navigator.of(context).pop(),
      ),
      centerTitle: true,
    );
  }

  Widget _buildErrorState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.cloud_off_rounded,
              size: 64,
              color: const Color(0xFF94A3B8),
            ),
            const SizedBox(height: 16),
            Text(
              'Oops!',
              style: GoogleFonts.outfit(
                fontSize: 24,
                fontWeight: FontWeight.w800,
                color: const Color(0xFF1E293B),
              ),
            ),
            const SizedBox(height: 8),
            Text(
              _error!,
              textAlign: TextAlign.center,
              style: GoogleFonts.outfit(
                fontSize: 14,
                color: const Color(0xFF64748B),
              ),
            ),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              onPressed: _loadCompanyProfile,
              icon: const Icon(Icons.refresh_rounded),
              label: const Text('Try Again'),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF3B82F6),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCompanyContent() {
    return SliverList(
      delegate: SliverChildListDelegate([
        _buildCompanyHero(),
        _buildCompanyDetails(),
        _buildJobOffersSection(),
        const SizedBox(height: 40),
      ]),
    );
  }

  Widget _buildCompanyHero() {
    final company = _company!;

    return Container(
      margin: const EdgeInsets.fromLTRB(20, 8, 20, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // Company Logo with Floating Animation
          _buildAnimatedLogo(company.picture),
          const SizedBox(height: 12),
          
          FadeTransition(
            opacity: _fadeAnimation,
            child: SlideTransition(
              position: _slideAnimation,
              child: Column(
                children: [
                  Text(
                    company.name,
                    style: GoogleFonts.outfit(
                      fontSize: 24,
                      fontWeight: FontWeight.w900,
                      color: const Color(0xFF1E293B),
                      letterSpacing: -0.5,
                    ),
                  ),
                  const SizedBox(height: 6),
                  if (_cleanText(company.industryName) != null)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                      decoration: BoxDecoration(
                        color: const Color(0xFF3B82F6).withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                        company.industryName!,
                        textAlign: TextAlign.center,
                        style: GoogleFonts.outfit(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: const Color(0xFF3B82F6),
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          // 2 KPIs Row
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              _buildLightKpiPill(
                icon: Icons.place_outlined,
                label: _cleanText(company.location) ?? _cleanText(company.country) ?? 'Tunisia',
                color: const Color(0xFF10B981),
                delay: 200,
              ),
              const SizedBox(width: 10),
              _buildLightKpiPill(
                icon: Icons.account_tree_outlined,
                label: '${company.departmentsCount ?? 1} Dept${(company.departmentsCount ?? 1) > 1 ? 's' : ''}',
                color: const Color(0xFF8B5CF6),
                delay: 300,
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildAnimatedLogo(String? pictureUrl) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0.0, end: 1.0),
      duration: const Duration(milliseconds: 1000),
      curve: Curves.elasticOut,
      builder: (context, value, child) {
        return Transform.scale(
          scale: value,
          child: child,
        );
      },
      child: _FloatingAnimatedWidget(
        child: Container(
          width: 80,
          height: 80,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(24),
            color: Colors.white,
            border: Border.all(
              color: const Color(0xFFE2E8F0),
              width: 2,
            ),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF3B82F6).withValues(alpha: 0.15),
                blurRadius: 20,
                offset: const Offset(0, 8),
              ),
            ],
            image: pictureUrl != null && pictureUrl.isNotEmpty
                ? DecorationImage(
                    image: NetworkImage(pictureUrl),
                    fit: BoxFit.cover,
                  )
                : null,
          ),
          child: pictureUrl == null || pictureUrl.isEmpty
              ? const Icon(
                  Icons.business_center_rounded,
                  size: 32,
                  color: Color(0xFF3B82F6),
                )
              : null,
        ),
      ),
    );
  }

  Widget _buildLightKpiPill({
    required IconData icon,
    required String label,
    required Color color,
    required int delay,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: color),
          const SizedBox(width: 6),
          Text(
            label,
            style: GoogleFonts.outfit(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: const Color(0xFF475569),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCompanyDetails() {
    final company = _company!;

    if (_cleanText(company.companyType) == null &&
        _cleanText(company.country) == null &&
        company.international != true) {
      return const SizedBox.shrink();
    }

    return Container(
      margin: const EdgeInsets.fromLTRB(20, 0, 20, 20),
      width: double.infinity,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Text(
            'Company Details',
            style: GoogleFonts.outfit(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: const Color(0xFF64748B),
              letterSpacing: 0.5,
            ),
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            alignment: WrapAlignment.center,
            children: [
              if (_cleanText(company.companyType) != null)
                _buildLightDetailTag(
                  icon: Icons.domain_outlined,
                  label: _formatLabel(company.companyType!),
                ),
              if (_cleanText(company.country) != null)
                _buildLightDetailTag(
                  icon: Icons.flag_outlined,
                  label: company.country!,
                ),
              if (company.international == true)
                _buildLightDetailTag(
                  icon: Icons.public_outlined,
                  label: 'International',
                  isHighlighted: true,
                ),
              if (company.employeeCount != null)
                _buildLightDetailTag(
                  icon: Icons.groups_outlined,
                  label: '${company.employeeCount} Employees',
                ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildLightDetailTag({
    required IconData icon,
    required String label,
    bool isHighlighted = false,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: isHighlighted
            ? const Color(0xFF3B82F6).withValues(alpha: 0.1)
            : Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: isHighlighted
              ? const Color(0xFF3B82F6).withValues(alpha: 0.2)
              : const Color(0xFFE2E8F0),
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            icon,
            size: 14,
            color: isHighlighted ? const Color(0xFF3B82F6) : const Color(0xFF64748B),
          ),
          const SizedBox(width: 6),
          Text(
            label,
            style: GoogleFonts.outfit(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: isHighlighted ? const Color(0xFF3B82F6) : const Color(0xFF475569),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildJobOffersSection() {
    final jobOffers = _company!.jobOffers;

    return Container(
      margin: const EdgeInsets.fromLTRB(20, 0, 20, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Open Positions',
                style: GoogleFonts.outfit(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: const Color(0xFF64748B),
                  letterSpacing: 0.5,
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: const Color(0xFF3B82F6).withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  '${jobOffers.length} ${jobOffers.length == 1 ? 'job' : 'jobs'}',
                  style: GoogleFonts.outfit(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: const Color(0xFF3B82F6),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          if (jobOffers.isEmpty)
            Center(
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 32),
                child: Column(
                  children: [
                    Icon(
                      Icons.work_outline,
                      size: 48,
                      color: const Color(0xFFCBD5E1),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      'No jobs posted yet',
                      style: GoogleFonts.outfit(
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                        color: const Color(0xFF94A3B8),
                      ),
                    ),
                  ],
                ),
              ),
            )
          else
            ...List.generate(jobOffers.length, (index) {
              return _buildAnimatedJobOfferCard(jobOffers[index], index);
            }),
        ],
      ),
    );
  }

  Widget _buildAnimatedJobOfferCard(JobOfferEntity job, int index) {
    return _buildLightJobOfferCard(job);
  }

  Widget _buildLightJobOfferCard(JobOfferEntity job) {
    final company = _company!;
    final datePosted = DateTime.tryParse(job.datePosted);
    final formattedDate = datePosted != null
        ? DateFormat('MMM d, yyyy').format(datePosted)
        : 'Recently';

    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      child: Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        child: InkWell(
          onTap: () {
            Navigator.push(
              context,
              MaterialPageRoute(
                builder: (_) => ApplyJobPage(job: job),
              ),
            );
          },
          borderRadius: BorderRadius.circular(20),
          child: Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: const Color(0xFFE2E8F0)),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.04),
                  blurRadius: 12,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            job.title,
                            style: GoogleFonts.outfit(
                              fontSize: 17,
                              fontWeight: FontWeight.w800,
                              color: const Color(0xFF1E293B),
                              letterSpacing: -0.3,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            _displayValue(
                              _cleanText(job.department) ?? _cleanText(company.name),
                            ),
                            style: GoogleFonts.outfit(
                              fontSize: 12,
                              fontWeight: FontWeight.w500,
                              color: const Color(0xFF64748B),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 12),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [Color(0xFF3B82F6), Color(0xFF2563EB)],
                        ),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        'Apply',
                        style: GoogleFonts.outfit(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: Colors.white,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    _buildLightJobTag(
                      label: _formatLabel(job.offerType),
                      color: const Color(0xFF10B981),
                    ),
                    if (_cleanText(job.contractType) != null)
                      _buildLightJobTag(
                        label: _formatLabel(job.contractType),
                        color: const Color(0xFF3B82F6),
                      ),
                    if (_cleanText(job.department) != null)
                      _buildLightJobTag(
                        label: job.department,
                        color: const Color(0xFF8B5CF6),
                      ),
                  ],
                ),
                const SizedBox(height: 12),
                Text(
                  _cleanText(job.description) ??
                      'No description provided for this role.',
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: GoogleFonts.outfit(
                    fontSize: 13,
                    height: 1.5,
                    color: const Color(0xFF64748B),
                    fontWeight: FontWeight.w400,
                  ),
                ),
                const SizedBox(height: 14),
                Wrap(
                  spacing: 14,
                  runSpacing: 8,
                  children: [
                    _buildLightMetaItem(
                      icon: Icons.place_rounded,
                      text: _displayValue(
                        _cleanText(job.location) ?? _cleanText(company.location),
                      ),
                    ),
                    _buildLightMetaItem(
                      icon: Icons.calendar_today_rounded,
                      text: formattedDate,
                    ),
                    if (job.budget > 0)
                      _buildLightMetaItem(
                        icon: Icons.payments_rounded,
                        text: '${job.budget.toStringAsFixed(0)} TND',
                        isHighlighted: true,
                      ),
                  ],
                ),
                if (job.skills.isNotEmpty)
                  ...[
                    const SizedBox(height: 14),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: job.skills.take(4).map((skill) {
                        return Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 5,
                          ),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF1F5F9),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            skill,
                            style: GoogleFonts.outfit(
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              color: const Color(0xFF475569),
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                  ],
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildLightJobTag({
    required String label,
    required Color color,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        label,
        style: GoogleFonts.outfit(
          fontSize: 11,
          fontWeight: FontWeight.w700,
          color: color,
        ),
      ),
    );
  }

  Widget _buildLightMetaItem({
    required IconData icon,
    required String text,
    bool isHighlighted = false,
  }) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(
          icon,
          size: 14,
          color: isHighlighted ? const Color(0xFF10B981) : const Color(0xFF94A3B8),
        ),
        const SizedBox(width: 6),
        Text(
          text,
          style: GoogleFonts.outfit(
            fontSize: 12,
            fontWeight: isHighlighted ? FontWeight.w700 : FontWeight.w500,
            color: isHighlighted ? const Color(0xFF10B981) : const Color(0xFF64748B),
          ),
        ),
      ],
    );
  }

}

class _PremiumLoader extends StatelessWidget {
  const _PremiumLoader();

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: CircularProgressIndicator(
        color: Color(0xFF3B82F6),
        strokeWidth: 3,
      ),
    );
  }
}

class _FloatingAnimatedWidget extends StatefulWidget {
  final Widget child;
  const _FloatingAnimatedWidget({required this.child});

  @override
  State<_FloatingAnimatedWidget> createState() => _FloatingAnimatedWidgetState();
}

class _FloatingAnimatedWidgetState extends State<_FloatingAnimatedWidget>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<Offset> _animation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat(reverse: true);

    _animation = Tween<Offset>(
      begin: Offset.zero,
      end: const Offset(0, 0.05),
    ).animate(CurvedAnimation(
      parent: _controller,
      curve: Curves.easeInOut,
    ));
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _animation,
      builder: (context, child) {
        return FractionalTranslation(
          translation: _animation.value,
          child: child,
        );
      },
      child: widget.child,
    );
  }
}
