import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../../core/services/api.service';
import { BaseChartDirective } from 'ng2-charts';
import { Chart, registerables, ChartData, ChartOptions, Plugin } from 'chart.js';

const pointValueLabelPlugin: Plugin<'line'> = {
  id: 'pointValueLabel',
  afterDatasetsDraw: (chart) => {
    if (chart.canvas.id !== 'weeklyRevenueChart') return;
    const dataset = chart.data.datasets?.[0];
    const meta = chart.getDatasetMeta(0);
    if (!dataset || !meta || meta.hidden) return;

    const ctx = chart.ctx;
    ctx.save();
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '700 12px "Trebuchet MS", "Segoe UI", sans-serif';
    ctx.textAlign = 'center';

    meta.data.forEach((point, index) => {
      const raw = (dataset.data as Array<number | string | null | undefined>)[index];
      if (raw === null || raw === undefined) return;
      const value = Number(raw);
      if (Number.isNaN(value) || value <= 0) return;
      const label = Number.isInteger(value) ? value.toString() : value.toFixed(1);
      ctx.fillText(label, point.x, point.y - 12);
    });

    ctx.restore();
  }
};

const chartFramePlugin: Plugin<'line'> = {
  id: 'chartFrame',
  beforeDraw: (chart) => {
    if (chart.canvas.id !== 'weeklyRevenueChart') return;
    const { ctx, chartArea } = chart;
    if (!chartArea) return;

    ctx.save();
    ctx.strokeStyle = 'rgba(203, 213, 225, 0.28)';
    ctx.lineWidth = 1;
    ctx.strokeRect(
      chartArea.left - 8,
      chartArea.top - 8,
      chartArea.right - chartArea.left + 16,
      chartArea.bottom - chartArea.top + 16
    );
    ctx.restore();
  }
};

Chart.register(...registerables, pointValueLabelPlugin, chartFramePlugin);

@Component({
  selector: 'app-data-analytics',
  standalone: true,
  imports: [CommonModule, BaseChartDirective],
  template: `
    <div class="p-6 font-['Outfit']">
      <div class="mb-12 flex flex-col items-center text-center">
        <h1 class="text-4xl font-black text-slate-900 tracking-tight">Market <span class="text-blue-600">Insights</span></h1>
        <p class="text-slate-500 font-medium mt-2 max-w-lg">Live analytics for industries, revenue, and enterprise distribution across Tunisia.</p>
      </div>

      <!-- FIRST LINE: MAP & INDUSTRY PIE -->
      <div class="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8 items-stretch">
        <!-- TUNISIA REGIONAL DISTRIBUTION (LEFT) -->
        <div class="bg-white rounded-[2.5rem] p-6 shadow-xl shadow-slate-200/50 border border-slate-100 flex flex-col">
           <div class="flex items-center justify-between mb-2">
              <h3 class="text-sm font-black uppercase tracking-widest text-slate-500">Regional Enterprise Distribution</h3>
           </div>
           
           <div class="flex-1 flex items-center justify-center relative min-h-[300px]">
              <div class="relative w-full max-w-[200px]">
                <svg viewBox="0 0 240 460" class="w-full h-full drop-shadow-2xl">
                  <path d="M120 20 L150 50 L160 80 L180 120 L190 180 L180 240 L160 300 L140 380 L110 440 L80 430 L60 380 L50 300 L60 220 L40 160 L50 100 L80 40 Z" 
                        fill="#f8fafc" stroke="#e2e8f0" stroke-width="2" />
                  
                  <ng-container *ngFor="let loc of locationMarkers">
                    <g [attr.transform]="'translate(' + loc.x + ',' + loc.y + ')'" class="cursor-pointer group">
                      <circle r="10" fill="currentColor" class="text-blue-500/20 animate-ping" *ngIf="loc.count > 0"></circle>
                      <circle r="4" fill="currentColor" [class]="loc.count > 0 ? 'text-blue-600' : 'text-slate-300'"></circle>
                      
                      <foreignObject x="8" y="-15" width="100" height="40" class="overflow-visible pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                        <div class="bg-slate-900 text-white p-2 rounded-xl border border-white/20 shadow-2xl scale-75 origin-left">
                          <p class="text-[9px] font-black uppercase tracking-widest whitespace-nowrap">{{ loc.name }}</p>
                          <p class="text-xs font-black">{{ loc.count }} Units</p>
                        </div>
                      </foreignObject>
                    </g>
                  </ng-container>
                </svg>
              </div>
           </div>
        </div>

        <!-- COMPANIES BY INDUSTRY (RIGHT) -->
        <div class="bg-white rounded-[2.5rem] p-8 shadow-xl shadow-slate-200/50 border border-slate-100 flex flex-col">
          <div class="flex items-center justify-between mb-6">
            <h3 class="text-sm font-black uppercase tracking-widest text-slate-500">Companies by Industry</h3>
            <span class="text-[10px] font-black uppercase tracking-widest text-blue-600">Live %</span>
          </div>
          <div class="h-64">
            <canvas
              baseChart
              [type]="'pie'"
              [data]="industryPieData"
              [options]="industryPieOptions">
            </canvas>
          </div>
          <div class="space-y-2 mt-4 max-h-40 overflow-auto pr-1">
            <div *ngFor="let item of analytics().industry_pie; let i = index" class="flex items-center justify-between text-sm">
              <div class="flex items-center gap-2 min-w-0">
                <span class="w-2.5 h-2.5 rounded-full" [style.background]="chartPalette[i % chartPalette.length]"></span>
                <span class="font-semibold text-slate-700 truncate text-xs">{{ item.name }}</span>
              </div>
              <span class="font-black text-slate-900 text-xs">{{ item.percentage }}%</span>
            </div>
          </div>
        </div>
      </div>

      <!-- SECOND LINE: TOTAL REVENUE -->
      <div class="mb-8">
        <div class="bg-slate-900 rounded-[2.5rem] p-8 shadow-2xl shadow-slate-900/20 border border-slate-800 text-white">
          <div class="flex items-center justify-between mb-6">
            <div>
              <h3 class="text-sm font-black uppercase tracking-widest text-slate-300">Total Revenue</h3>
              <p class="text-3xl font-black mt-1">{{ analytics().total_revenue || 0 | number:'1.2-2' }} <span class="text-sm text-slate-400">DT</span></p>
            </div>
            <span class="text-[10px] font-black uppercase tracking-widest text-blue-300">{{ analytics().revenue_trend_period || 'Last 7 days' }}</span>
          </div>
          <div class="h-64">
            <canvas
              id="weeklyRevenueChart"
              baseChart
              [type]="'line'"
              [data]="weeklyRevenueLineData"
              [options]="weeklyRevenueLineOptions">
            </canvas>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-[2.5rem] p-8 shadow-xl shadow-slate-200/50 border border-slate-100">
        <div class="flex items-center justify-between mb-6">
          <div>
            <h3 class="text-sm font-black uppercase tracking-widest text-slate-500">Daily New Candidate Signups</h3>
            <div class="flex items-baseline gap-3 mt-1">
              <p class="text-3xl font-black text-slate-900">{{ analytics().daily_candidate_signups?.total || 0 }}</p>
              <p class="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Last 7 Days</p>
            </div>
          </div>
          <span class="text-[10px] font-black uppercase tracking-widest text-indigo-600">Real time</span>
        </div>
        <div class="h-52">
          <canvas
            baseChart
            [type]="'line'"
            [data]="dailySignupsLineData"
            [options]="dailySignupsLineOptions">
          </canvas>
        </div>
      </div>
    </div>
  `,
})
export class DataAnalyticsComponent implements OnInit, OnDestroy {
  private readonly apiService = inject(ApiService);
  private refreshIntervalId: ReturnType<typeof setInterval> | null = null;

  analytics = signal<any>({
    industry_pie: [],
    weekly_revenue: { labels: [], values: [], total: 0 },
    total_revenue: 0,
    revenue_trend_period: 'Last 7 days',
    daily_candidate_signups: { labels: [], values: [], total: 0 },
    company_locations: {},
    updated_at: null,
  });

  locationMarkers = [
    { name: 'Tunis', x: 120, y: 70, count: 0 },
    { name: 'Ariana', x: 135, y: 60, count: 0 },
    { name: 'Ben Arous', x: 140, y: 85, count: 0 },
    { name: 'Manouba', x: 105, y: 75, count: 0 },
    { name: 'Nabeul', x: 165, y: 110, count: 0 },
    { name: 'Zaghouan', x: 130, y: 120, count: 0 },
    { name: 'Bizerte', x: 110, y: 35, count: 0 },
    { name: 'Béja', x: 80, y: 80, count: 0 },
    { name: 'Jendouba', x: 60, y: 70, count: 0 },
    { name: 'Le Kef', x: 60, y: 130, count: 0 },
    { name: 'Siliana', x: 90, y: 150, count: 0 },
    { name: 'Kairouan', x: 120, y: 190, count: 0 },
    { name: 'Kasserine', x: 70, y: 220, count: 0 },
    { name: 'Sidi Bouzid', x: 100, y: 250, count: 0 },
    { name: 'Sousse', x: 155, y: 160, count: 0 },
    { name: 'Monastir', x: 175, y: 175, count: 0 },
    { name: 'Mahdia', x: 180, y: 210, count: 0 },
    { name: 'Sfax', x: 160, y: 270, count: 0 },
    { name: 'Gafsa', x: 85, y: 290, count: 0 },
    { name: 'Tozeur', x: 50, y: 310, count: 0 },
    { name: 'Kebili', x: 80, y: 350, count: 0 },
    { name: 'Gabès', x: 130, y: 330, count: 0 },
    { name: 'Medenine', x: 155, y: 380, count: 0 },
    { name: 'Tataouine', x: 130, y: 430, count: 0 }
  ];

  readonly chartPalette = ['#2563EB', '#38BDF8', '#4F46E5', '#14B8A6', '#8B5CF6', '#0EA5E9', '#1D4ED8'];

  readonly industryPieOptions: ChartOptions<'pie'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { enabled: true },
    },
  };

  readonly weeklyRevenueLineOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: true,
        backgroundColor: 'rgba(10,35,56,0.92)',
        borderColor: 'rgba(148,163,184,0.25)',
        borderWidth: 1,
        titleColor: '#e2e8f0',
        bodyColor: '#f8fafc',
      }
    },
    animation: {
      duration: 900,
      easing: 'easeOutCubic',
    },
    scales: {
      x: {
        ticks: { color: '#cbd5e1', font: { size: 11, weight: 'bold' } },
        grid: { display: false },
        border: { color: 'rgba(148,163,184,0.45)' },
      },
      y: {
        ticks: { color: '#cbd5e1', font: { size: 11 } },
        grid: { color: 'rgba(148,163,184,0.14)' },
        border: { color: 'rgba(148,163,184,0.45)' },
        beginAtZero: false
      },
    },
    elements: {
      line: { tension: 0.45, borderWidth: 1.35 },
      point: {
        radius: 2.3,
        hoverRadius: 5,
        backgroundColor: '#f1f5f9',
        borderColor: '#0f172a',
        borderWidth: 1,
      }
    },
  };

  readonly dailySignupsLineOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    animation: {
      duration: 900,
      easing: 'easeOutCubic',
    },
    scales: {
      x: {
        ticks: { color: '#64748b', font: { size: 10, weight: 'bold' } },
        grid: { display: false }
      },
      y: {
        ticks: { color: '#64748b', font: { size: 10 } },
        grid: { color: 'rgba(226,232,240,0.5)' },
        beginAtZero: true
      },
    },
    elements: {
      line: { tension: 0.4, borderWidth: 3.5 },
      point: { radius: 4, hoverRadius: 6, backgroundColor: '#6366F1' }
    },
  };

  ngOnInit() {
    this.loadAdvancedAnalytics();
    this.refreshIntervalId = setInterval(() => {
      this.loadAdvancedAnalytics();
    }, 5000);
  }

  ngOnDestroy() {
    if (this.refreshIntervalId) {
      clearInterval(this.refreshIntervalId);
      this.refreshIntervalId = null;
    }
  }

  loadAdvancedAnalytics() {
    this.apiService.get<any>('admin/advanced-analytics').subscribe({
      next: (response) => {
        if (response.success) {
          this.analytics.set(response.data);
          this.updateMapMarkers(response.data.company_locations || {});
        }
      },
      error: (err) => console.error('Error loading advanced analytics:', err),
    });
  }

  updateMapMarkers(locations: any) {
    this.locationMarkers = this.locationMarkers.map(marker => ({
      ...marker,
      count: locations[marker.name] || 0
    }));
  }

  get industryPieData(): ChartData<'pie', number[], string> {
    const parts = this.analytics().industry_pie || [];
    return {
      labels: parts.map((item: any) => item.name),
      datasets: [
        {
          data: parts.map((item: any) => Number(item.count || 0)),
          backgroundColor: parts.map((_: any, i: number) => this.chartPalette[i % this.chartPalette.length]),
          borderColor: '#ffffff',
          borderWidth: 2,
        },
      ],
    };
  }

  get weeklyRevenueLineData(): ChartData<'line', number[], string> {
    const revenue = this.analytics().weekly_revenue || { labels: [], values: [] };
    return {
      labels: revenue.labels || [],
      datasets: [
        {
          data: (revenue.values || []).map((value: any) => Number(value || 0)),
          borderColor: '#bfeaf3',
          backgroundColor: (context: any) => {
            const { chart } = context;
            const { ctx, chartArea } = chart;
            if (!chartArea) return 'rgba(45,212,191,0.45)';
            const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            gradient.addColorStop(0, 'rgba(45,212,191,0.62)');
            gradient.addColorStop(0.6, 'rgba(45,212,191,0.22)');
            gradient.addColorStop(1, 'rgba(45,212,191,0.03)');
            return gradient;
          },
          fill: true,
        },
      ],
    };
  }

  get dailySignupsLineData(): ChartData<'line', number[], string> {
    const signups = this.analytics().daily_candidate_signups || { labels: [], values: [] };
    return {
      labels: signups.labels || [],
      datasets: [
        {
          data: (signups.values || []).map((value: any) => Number(value || 0)),
          borderColor: '#6366F1',
          backgroundColor: 'rgba(99,102,241,0.18)',
          fill: true,
        },
      ],
    };
  }
}
